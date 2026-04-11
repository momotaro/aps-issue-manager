import { describe, expect, it } from "vitest";
import type { IssueHistoryEvent } from "@/repositories/issue-repository";
import { buildTimelineItems } from "./issue-history.hooks";

// ---------------------------------------------------------------------------
// テストデータファクトリ
// ---------------------------------------------------------------------------

const makeStatusChangedEvent = (
  overrides: Partial<IssueHistoryEvent> = {},
): IssueHistoryEvent =>
  ({
    id: "evt0000001",
    issueId: "iss0000001",
    type: "IssueStatusChanged",
    payload: { from: "open", to: "in_progress" },
    actorId: "000000002dwHTRTFRxWLTN",
    version: 2,
    occurredAt: "2026-04-10T10:00:00.000Z",
    ...overrides,
  }) as IssueHistoryEvent;

const makeCommentAddedEvent = (
  overrides: Partial<IssueHistoryEvent> = {},
): IssueHistoryEvent =>
  ({
    id: "evt0000002",
    issueId: "iss0000001",
    type: "CommentAdded",
    payload: {
      comment: {
        commentId: "c000000000000000000001",
        body: "テストコメント",
        actorId: "000000002dwHTRTFRxWLTN",
        attachments: [],
        createdAt: "2026-04-10T11:00:00.000Z",
      },
    },
    actorId: "000000002dwHTRTFRxWLTN",
    version: 3,
    occurredAt: "2026-04-10T11:00:00.000Z",
    ...overrides,
  }) as IssueHistoryEvent;

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("buildTimelineItems", () => {
  it("空のイベント列を渡すと空配列を返す", () => {
    expect(buildTimelineItems([])).toEqual([]);
  });

  it("CommentAdded イベントを comment アイテムに変換する", () => {
    const events = [makeCommentAddedEvent()];
    const items = buildTimelineItems(events);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("comment");
    if (items[0].type === "comment") {
      expect(items[0].body).toBe("テストコメント");
      expect(items[0].commentId).toBe("c000000000000000000001");
    }
  });

  it("IssueStatusChanged イベントを statusChange アイテムに変換する", () => {
    const events = [makeStatusChangedEvent()];
    const items = buildTimelineItems(events);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("statusChange");
    if (items[0].type === "statusChange") {
      expect(items[0].toStatus).toBe("in_progress");
      expect(items[0].toLabel).toBe("対応中");
    }
  });

  it("IssueCreated など対象外のイベントは無視する", () => {
    const events = [
      {
        id: "evt0000003",
        issueId: "iss0000001",
        type: "IssueCreated",
        payload: {},
        actorId: "000000002dwHTRTFRxWLTN",
        version: 1,
        occurredAt: "2026-04-10T09:00:00.000Z",
      } as unknown as IssueHistoryEvent,
    ];
    expect(buildTimelineItems(events)).toHaveLength(0);
  });

  it("CommentAdded と IssueStatusChanged が occurredAt 昇順で混在する", () => {
    const events = [
      makeStatusChangedEvent({ occurredAt: "2026-04-10T10:00:00.000Z" }),
      makeCommentAddedEvent({
        payload: {
          comment: {
            commentId: "c2",
            body: "後のコメント",
            actorId: "000000002dwHTRTFRxWLTN",
            attachments: [],
            createdAt: "2026-04-10T12:00:00.000Z",
          },
        },
        occurredAt: "2026-04-10T12:00:00.000Z",
      }),
      makeCommentAddedEvent({
        id: "evt_early",
        payload: {
          comment: {
            commentId: "c1",
            body: "最初のコメント",
            actorId: "000000002dwHTRTFRxWLTN",
            attachments: [],
            createdAt: "2026-04-10T09:00:00.000Z",
          },
        },
        occurredAt: "2026-04-10T09:00:00.000Z",
      }),
    ];
    const items = buildTimelineItems(events);
    expect(items).toHaveLength(3);
    // 昇順確認
    const times = items.map((item) =>
      item.type === "comment" ? item.createdAt : item.occurredAt,
    );
    expect(times[0] <= times[1]).toBe(true);
    expect(times[1] <= times[2]).toBe(true);
    // 最初は最初のコメント
    expect(items[0].type).toBe("comment");
    if (items[0].type === "comment")
      expect(items[0].body).toBe("最初のコメント");
  });

  it("コメントのみの場合は全件 comment アイテムを返す", () => {
    const events = [
      makeCommentAddedEvent({
        id: "e1",
        occurredAt: "2026-04-10T10:00:00.000Z",
      }),
      makeCommentAddedEvent({
        id: "e2",
        occurredAt: "2026-04-10T11:00:00.000Z",
      }),
    ];
    const items = buildTimelineItems(events);
    expect(items.every((i) => i.type === "comment")).toBe(true);
    expect(items).toHaveLength(2);
  });

  it("ステータス変更のみの場合は全件 statusChange アイテムを返す", () => {
    const events = [
      makeStatusChangedEvent({
        id: "e1",
        payload: { from: "open", to: "in_progress" },
        occurredAt: "2026-04-10T10:00:00.000Z",
      }),
      makeStatusChangedEvent({
        id: "e2",
        payload: { from: "in_progress", to: "in_review" },
        occurredAt: "2026-04-10T11:00:00.000Z",
      }),
    ];
    const items = buildTimelineItems(events);
    expect(items.every((i) => i.type === "statusChange")).toBe(true);
    expect(items).toHaveLength(2);
    if (items[1].type === "statusChange") {
      expect(items[1].toStatus).toBe("in_review");
      expect(items[1].toLabel).toBe("レビュー中");
    }
  });

  it("全ステータスのアイコンマッピング確認: done/in_progress/in_review/open", () => {
    const statuses = ["done", "in_progress", "in_review", "open"] as const;
    for (const to of statuses) {
      const events = [
        makeStatusChangedEvent({ payload: { from: "open", to } }),
      ];
      const items = buildTimelineItems(events);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("statusChange");
      if (items[0].type === "statusChange") {
        expect(items[0].toStatus).toBe(to);
      }
    }
  });

  it("同一 occurredAt の場合、comment が statusChange より前に並ぶ", () => {
    const sameTime = "2026-04-10T10:00:00.000Z";
    const events = [
      makeStatusChangedEvent({ id: "e_status", occurredAt: sameTime }),
      makeCommentAddedEvent({
        id: "e_comment",
        payload: {
          comment: {
            commentId: "c_same",
            body: "同時刻コメント",
            actorId: "000000002dwHTRTFRxWLTN",
            attachments: [],
            createdAt: sameTime,
          },
        },
        occurredAt: sameTime,
      }),
    ];
    const items = buildTimelineItems(events);
    expect(items[0].type).toBe("comment");
    expect(items[1].type).toBe("statusChange");
  });

  it("actorId が存在しないユーザーの場合、actorName が「不明なユーザー」になる", () => {
    const events = [makeStatusChangedEvent({ actorId: "unknownActorId99999" })];
    const items = buildTimelineItems(events);
    if (items[0].type === "statusChange") {
      expect(items[0].actorName).toBe("不明なユーザー");
    }
  });
});
