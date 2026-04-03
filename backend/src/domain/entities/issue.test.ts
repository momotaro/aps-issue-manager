import { describe, expect, it } from "vitest";
import type { IssueDomainEvent } from "../events/issueEvents.js";
import {
  generateId,
  type PhotoId,
  type ProjectId,
  parseId,
  type UserId,
} from "../valueObjects/brandedId.js";
import { createPhoto } from "../valueObjects/photo.js";
import { createSpatialPosition } from "../valueObjects/position.js";
import {
  addPhoto,
  applyEvent,
  changeAssignee,
  changeCategory,
  changeStatus,
  createIssue,
  rehydrate,
  rehydrateFromSnapshot,
  removePhoto,
  updateDescription,
  updateTitle,
} from "./issue.js";

// ---------------------------------------------------------------------------
// テスト用ヘルパー
// ---------------------------------------------------------------------------

const actorId = parseId<UserId>("01ACTOR000000000000000ACTOR");
const projectId = parseId<ProjectId>("01PROJ0000000000000000PROJ0");
const reporterId = parseId<UserId>("01REPORTER00000000000REPORT");

const validParams = {
  projectId,
  title: "壁のひび割れ",
  description: "3階東側の壁にひび割れを確認",
  category: "quality_defect" as const,
  position: createSpatialPosition(10, 20, 30),
  reporterId,
  assigneeId: null,
  photos: [] as const,
  actorId,
};

/** createIssue で生成した IssueCreatedEvent を返す */
const makeCreatedEvent = () => {
  const result = createIssue(validParams);
  if (!result.ok) throw new Error("createIssue failed");
  return result.value;
};

/** IssueCreatedEvent を適用した Issue 状態を返す */
const makeIssue = () => {
  const event = makeCreatedEvent();
  return applyEvent(null, event);
};

// ---------------------------------------------------------------------------
// createIssue
// ---------------------------------------------------------------------------

describe("createIssue", () => {
  it("有効なパラメータで IssueCreatedEvent を生成する", () => {
    const result = createIssue(validParams);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.type).toBe("IssueCreated");
    expect(result.value.version).toBe(1);
    expect(result.value.payload.status).toBe("open");
    expect(result.value.payload.title).toBe("壁のひび割れ");
    expect(result.value.payload.projectId).toBe(projectId);
  });

  it("空のタイトルでエラーを返す", () => {
    const result = createIssue({ ...validParams, title: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_TITLE");
    }
  });

  it("タイトルの前後空白をトリムする", () => {
    const result = createIssue({ ...validParams, title: "  壁のひび割れ  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.payload.title).toBe("壁のひび割れ");
    }
  });
});

// ---------------------------------------------------------------------------
// applyEvent + rehydrate
// ---------------------------------------------------------------------------

describe("applyEvent", () => {
  it("IssueCreated から初期状態を復元する", () => {
    const issue = makeIssue();
    expect(issue.status).toBe("open");
    expect(issue.title).toBe("壁のひび割れ");
    expect(issue.version).toBe(1);
    expect(issue.photos).toHaveLength(0);
  });

  it("IssueTitleUpdated でタイトルを更新する", () => {
    const issue = makeIssue();
    const event = updateTitle(issue, "壁のひび割れ（修正）", actorId);
    expect(event.ok).toBe(true);
    if (!event.ok) return;

    const updated = applyEvent(issue, event.value);
    expect(updated.title).toBe("壁のひび割れ（修正）");
    expect(updated.version).toBe(2);
  });
});

describe("rehydrate", () => {
  it("複数イベントを順に適用して最終状態を復元する", () => {
    const createdEvent = makeCreatedEvent();
    const issue1 = applyEvent(null, createdEvent);

    const statusResult = changeStatus(issue1, "in_progress", actorId);
    expect(statusResult.ok).toBe(true);
    if (!statusResult.ok) return;

    const titleResult = updateTitle(issue1, "壁の大きなひび割れ", actorId);
    // version 競合を避けるため、issue1 ベースで version +1 を使う
    // rehydrate は events 配列を順に適用するので問題ない
    expect(titleResult.ok).toBe(true);
    if (!titleResult.ok) return;

    const events: IssueDomainEvent[] = [
      createdEvent,
      statusResult.value,
      titleResult.value,
    ];
    const final = rehydrate(events);

    expect(final).not.toBeNull();
    expect(final?.status).toBe("in_progress");
    expect(final?.title).toBe("壁の大きなひび割れ");
    expect(final?.version).toBe(2); // 同じ version +1 が2回なので最後に適用された方
  });

  it("空のイベント列で null を返す", () => {
    expect(rehydrate([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// コマンド関数
// ---------------------------------------------------------------------------

describe("changeStatus", () => {
  it("有効な遷移で IssueStatusChangedEvent を返す", () => {
    const issue = makeIssue();
    const result = changeStatus(issue, "in_progress", actorId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.type).toBe("IssueStatusChanged");
    expect(result.value.payload.from).toBe("open");
    expect(result.value.payload.to).toBe("in_progress");
    expect(result.value.version).toBe(2);
  });

  it("無効な遷移でエラーを返す", () => {
    const issue = makeIssue();
    const result = changeStatus(issue, "done", actorId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_TRANSITION");
    }
  });
});

describe("updateTitle", () => {
  it("同じタイトルで NO_CHANGE エラーを返す", () => {
    const issue = makeIssue();
    const result = updateTitle(issue, "壁のひび割れ", actorId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_CHANGE");
    }
  });

  it("空のタイトルで EMPTY_TITLE エラーを返す", () => {
    const issue = makeIssue();
    const result = updateTitle(issue, "  ", actorId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_TITLE");
    }
  });
});

describe("updateDescription", () => {
  it("説明を更新する", () => {
    const issue = makeIssue();
    const result = updateDescription(issue, "新しい説明", actorId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.type).toBe("IssueDescriptionUpdated");
    expect(result.value.payload.description).toBe("新しい説明");
  });

  it("同じ説明で NO_CHANGE エラーを返す", () => {
    const issue = makeIssue();
    const result = updateDescription(issue, issue.description, actorId);
    expect(result.ok).toBe(false);
  });
});

describe("changeCategory", () => {
  it("種別を変更する", () => {
    const issue = makeIssue();
    const result = changeCategory(issue, "safety_hazard", actorId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.payload.category).toBe("safety_hazard");
  });

  it("同じ種別で NO_CHANGE エラーを返す", () => {
    const issue = makeIssue();
    const result = changeCategory(issue, "quality_defect", actorId);
    expect(result.ok).toBe(false);
  });
});

describe("changeAssignee", () => {
  it("担当者を割り当てる", () => {
    const issue = makeIssue();
    const assigneeId = parseId<UserId>("01ASSIGNEE0000000000ASSIGN");
    const result = changeAssignee(issue, assigneeId, actorId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.payload.assigneeId).toBe(assigneeId);
  });

  it("同じ担当者で NO_CHANGE エラーを返す", () => {
    const issue = makeIssue(); // assigneeId = null
    const result = changeAssignee(issue, null, actorId);
    expect(result.ok).toBe(false);
  });
});

describe("addPhoto / removePhoto", () => {
  const photo = createPhoto({
    id: generateId<PhotoId>(),
    fileName: "crack.jpg",
    storagePath: "confirmed/xxx/before/yyy.jpg",
    phase: "before",
    uploadedAt: new Date(),
  });

  it("写真を追加する", () => {
    const issue = makeIssue();
    const result = addPhoto(issue, photo, actorId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const updated = applyEvent(issue, result.value);
    expect(updated.photos).toHaveLength(1);
    expect(updated.photos[0].fileName).toBe("crack.jpg");
  });

  it("重複する写真 ID でエラーを返す", () => {
    const issue = makeIssue();
    const addResult = addPhoto(issue, photo, actorId);
    if (!addResult.ok) return;

    const withPhoto = applyEvent(issue, addResult.value);
    const dupResult = addPhoto(withPhoto, photo, actorId);
    expect(dupResult.ok).toBe(false);
    if (!dupResult.ok) {
      expect(dupResult.error.code).toBe("DUPLICATE_PHOTO");
    }
  });

  it("写真を削除する", () => {
    const issue = makeIssue();
    const addResult = addPhoto(issue, photo, actorId);
    if (!addResult.ok) return;

    const withPhoto = applyEvent(issue, addResult.value);
    const removeResult = removePhoto(withPhoto, photo.id, actorId);
    expect(removeResult.ok).toBe(true);
    if (!removeResult.ok) return;

    const afterRemove = applyEvent(withPhoto, removeResult.value);
    expect(afterRemove.photos).toHaveLength(0);
  });

  it("存在しない写真 ID でエラーを返す", () => {
    const issue = makeIssue();
    const result = removePhoto(issue, generateId<PhotoId>(), actorId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PHOTO_NOT_FOUND");
    }
  });
});

// ---------------------------------------------------------------------------
// applyEvent — コマンド結果の状態適用
// ---------------------------------------------------------------------------

describe("applyEvent（全イベント型の状態適用）", () => {
  it("IssueDescriptionUpdated で説明を更新する", () => {
    const issue = makeIssue();
    const result = updateDescription(issue, "更新された説明", actorId);
    if (!result.ok) throw new Error();

    const updated = applyEvent(issue, result.value);
    expect(updated.description).toBe("更新された説明");
    expect(updated.version).toBe(2);
  });

  it("IssueStatusChanged でステータスを更新する", () => {
    const issue = makeIssue();
    const result = changeStatus(issue, "in_progress", actorId);
    if (!result.ok) throw new Error();

    const updated = applyEvent(issue, result.value);
    expect(updated.status).toBe("in_progress");
  });

  it("IssueCategoryChanged で種別を更新する", () => {
    const issue = makeIssue();
    const result = changeCategory(issue, "safety_hazard", actorId);
    if (!result.ok) throw new Error();

    const updated = applyEvent(issue, result.value);
    expect(updated.category).toBe("safety_hazard");
  });

  it("IssueAssigneeChanged で担当者を更新する", () => {
    const issue = makeIssue();
    const assigneeId = parseId<UserId>("01ASSIGNEE0000000000ASSIGN");
    const result = changeAssignee(issue, assigneeId, actorId);
    if (!result.ok) throw new Error();

    const updated = applyEvent(issue, result.value);
    expect(updated.assigneeId).toBe(assigneeId);
  });
});

// ---------------------------------------------------------------------------
// rehydrateFromSnapshot
// ---------------------------------------------------------------------------

describe("rehydrateFromSnapshot", () => {
  it("スナップショットと差分イベントから最終状態を復元する", () => {
    const issue = makeIssue(); // version 1 のスナップショットとみなす

    const statusResult = changeStatus(issue, "in_progress", actorId);
    if (!statusResult.ok) throw new Error();
    const titleResult = updateTitle(
      applyEvent(issue, statusResult.value),
      "更新タイトル",
      actorId,
    );
    if (!titleResult.ok) throw new Error();

    const final = rehydrateFromSnapshot(issue, [
      statusResult.value,
      titleResult.value,
    ]);
    expect(final.status).toBe("in_progress");
    expect(final.title).toBe("更新タイトル");
    expect(final.version).toBe(3);
  });

  it("差分イベントが空ならスナップショットをそのまま返す", () => {
    const issue = makeIssue();
    const result = rehydrateFromSnapshot(issue, []);
    expect(result).toEqual(issue);
  });
});
