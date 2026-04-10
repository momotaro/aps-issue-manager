import { describe, expect, it } from "vitest";
import type { IssueDomainEvent } from "../events/issueEvents.js";
import {
  type CommentId,
  generateId,
  type IssueId,
  type PhotoId,
  type ProjectId,
  parseId,
  type UserId,
} from "../valueObjects/brandedId.js";
import { COMMENT_MAX_LENGTH } from "../valueObjects/comment.js";
import { createPhoto } from "../valueObjects/photo.js";
import { createSpatialPosition } from "../valueObjects/position.js";
import {
  addComment,
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

const makeValidParams = () => ({
  issueId: generateId<IssueId>(),
  projectId,
  title: "壁のひび割れ",
  description: "3階東側の壁にひび割れを確認",
  category: "quality_defect" as const,
  position: createSpatialPosition(10, 20, 30),
  reporterId,
  assigneeId: null,
  photos: [] as const,
  actorId,
});

/** createIssue で生成した IssueCreatedEvent を返す */
const makeCreatedEvent = () => {
  const result = createIssue(makeValidParams());
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
    const result = createIssue(makeValidParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.type).toBe("IssueCreated");
    expect(result.value.version).toBe(1);
    expect(result.value.payload.status).toBe("open");
    expect(result.value.payload.title).toBe("壁のひび割れ");
    expect(result.value.payload.projectId).toBe(projectId);
  });

  it("空のタイトルでエラーを返す", () => {
    const result = createIssue({ ...makeValidParams(), title: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_TITLE");
    }
  });

  it("タイトルの前後空白をトリムする", () => {
    const result = createIssue({
      ...makeValidParams(),
      title: "  壁のひび割れ  ",
    });
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
// addComment
// ---------------------------------------------------------------------------

describe("addComment", () => {
  it("有効なコメントで CommentAddedEvent を生成する", () => {
    const issue = makeIssue();
    const commentId = generateId<CommentId>();
    const result = addComment(issue, commentId, "コメント本文", actorId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.type).toBe("CommentAdded");
    expect(result.value.version).toBe(issue.version + 1);
    expect(result.value.payload.comment.body).toBe("コメント本文");
    expect(result.value.payload.comment.commentId).toBe(commentId);
    expect(result.value.payload.comment.actorId).toBe(actorId);
  });

  it("空文字のコメントで EMPTY_COMMENT エラーを返す", () => {
    const issue = makeIssue();
    const result = addComment(issue, generateId<CommentId>(), "", actorId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_COMMENT");
    }
  });

  it("空白のみのコメントで EMPTY_COMMENT エラーを返す", () => {
    const issue = makeIssue();
    const result = addComment(issue, generateId<CommentId>(), "   ", actorId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_COMMENT");
    }
  });

  it("コメント本文の前後空白をトリムする", () => {
    const issue = makeIssue();
    const result = addComment(
      issue,
      generateId<CommentId>(),
      "  本文  ",
      actorId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.payload.comment.body).toBe("本文");
    const updated = applyEvent(issue, result.value);
    expect(updated.comments[0].body).toBe("本文");
  });

  it(`本文が ${COMMENT_MAX_LENGTH} 文字を超える場合 BODY_TOO_LONG エラーを返す`, () => {
    const issue = makeIssue();
    const longBody = "あ".repeat(COMMENT_MAX_LENGTH + 1);
    const result = addComment(
      issue,
      generateId<CommentId>(),
      longBody,
      actorId,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BODY_TOO_LONG");
    }
  });

  it(`本文がちょうど ${COMMENT_MAX_LENGTH} 文字の場合は成功する`, () => {
    const issue = makeIssue();
    const maxBody = "あ".repeat(COMMENT_MAX_LENGTH);
    const result = addComment(issue, generateId<CommentId>(), maxBody, actorId);
    expect(result.ok).toBe(true);
  });
});

describe("applyEvent（CommentAdded）", () => {
  it("CommentAdded で comments 配列にコメントが追加される", () => {
    const issue = makeIssue();
    expect(issue.comments).toHaveLength(0);

    const result = addComment(issue, generateId<CommentId>(), "本文", actorId);
    if (!result.ok) throw new Error();

    const updated = applyEvent(issue, result.value);
    expect(updated.comments).toHaveLength(1);
    expect(updated.comments[0].body).toBe("本文");
    expect(updated.version).toBe(issue.version + 1);
  });

  it("複数のコメントを追加できる", () => {
    const issue = makeIssue();
    const r1 = addComment(issue, generateId<CommentId>(), "1件目", actorId);
    if (!r1.ok) throw new Error();
    const issue2 = applyEvent(issue, r1.value);

    const r2 = addComment(issue2, generateId<CommentId>(), "2件目", actorId);
    if (!r2.ok) throw new Error();
    const issue3 = applyEvent(issue2, r2.value);

    expect(issue3.comments).toHaveLength(2);
    expect(issue3.comments[1].body).toBe("2件目");
  });

  it("applyEvent は元の issue を変更しない（イミュータビリティ）", () => {
    const issue = makeIssue();
    const result = addComment(issue, generateId<CommentId>(), "本文", actorId);
    if (!result.ok) throw new Error();
    applyEvent(issue, result.value);
    expect(issue.comments).toHaveLength(0);
  });

  it("rehydrate で CommentAdded を含むイベント列から正しく復元できる", () => {
    const createdEvent = makeCreatedEvent();
    const issue = applyEvent(null, createdEvent);

    const r1 = addComment(issue, generateId<CommentId>(), "コメント1", actorId);
    if (!r1.ok) throw new Error();
    const issue2 = applyEvent(issue, r1.value);
    const r2 = addComment(
      issue2,
      generateId<CommentId>(),
      "コメント2",
      actorId,
    );
    if (!r2.ok) throw new Error();

    const final = rehydrate([createdEvent, r1.value, r2.value]);
    expect(final).not.toBeNull();
    expect(final?.comments).toHaveLength(2);
    expect(final?.comments[0].body).toBe("コメント1");
    expect(final?.comments[1].body).toBe("コメント2");
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
