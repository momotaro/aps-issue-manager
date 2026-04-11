import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  CommentTimelineItem,
  StatusChangeTimelineItem,
  TimelineItem,
} from "./issue-history.hooks";
import { Timeline } from "./timeline";

const makeCommentItem = (
  overrides: Partial<CommentTimelineItem> = {},
): CommentTimelineItem => ({
  type: "comment",
  commentId: "c000000000000000000001",
  body: "テストコメント",
  actorId: "000000002dwHTRTFRxWLTN",
  attachments: [],
  createdAt: "2026-04-10T14:00:00.000Z",
  ...overrides,
});

const makeStatusChangeItem = (
  overrides: Partial<StatusChangeTimelineItem> = {},
): StatusChangeTimelineItem => ({
  type: "statusChange",
  eventId: "evt0000001",
  actorName: "田中 太郎",
  toLabel: "対応中",
  toStatus: "in_progress",
  occurredAt: "2026-04-10T10:00:00.000Z",
  ...overrides,
});

describe("Timeline", () => {
  it("アイテムがない場合は空メッセージを表示する", () => {
    render(<Timeline issueId="i1" items={[]} isLoading={false} />);
    expect(screen.getByText("まだコメントがありません")).toBeDefined();
  });

  it("コメントアイテムを全件表示する", () => {
    const items: TimelineItem[] = [
      makeCommentItem({
        commentId: "c1",
        body: "最初のコメント",
        createdAt: "2026-04-08T14:00:00.000Z",
      }),
      makeCommentItem({
        commentId: "c2",
        body: "2 番目のコメント",
        createdAt: "2026-04-09T09:15:00.000Z",
      }),
      makeCommentItem({
        commentId: "c3",
        body: "最新のコメント",
        createdAt: "2026-04-10T16:30:00.000Z",
      }),
    ];
    render(<Timeline issueId="i1" items={items} isLoading={false} />);
    expect(screen.getByText("最初のコメント")).toBeDefined();
    expect(screen.getByText("2 番目のコメント")).toBeDefined();
    expect(screen.getByText("最新のコメント")).toBeDefined();
    expect(screen.getByText("3件")).toBeDefined();
  });

  it("XSS: <script> タグ文字列は DOM に挿入されずエスケープされる", () => {
    const malicious = '<script>alert("xss")</script>悪意あるコメント';
    const items: TimelineItem[] = [makeCommentItem({ body: malicious })];
    const { container } = render(
      <Timeline issueId="i1" items={items} isLoading={false} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(malicious)).toBeDefined();
  });

  it("添付画像がある場合はサムネイルボタンを表示する", () => {
    const items: TimelineItem[] = [
      makeCommentItem({
        attachments: [
          {
            id: "p000000000000000000001",
            fileName: "photo.jpg",
            storagePath:
              "confirmed/i000000000000000000001/c000000000000000000001/p000000000000000000001.jpg",
            uploadedAt: "2026-04-10T16:30:00.000Z",
          },
        ],
      }),
    ];
    render(<Timeline issueId="i1" items={items} isLoading={false} />);
    expect(screen.getByLabelText("添付画像: photo.jpg")).toBeDefined();
  });

  it("ステータス変更アイテムを pill 形式で表示する", () => {
    const items: TimelineItem[] = [
      makeStatusChangeItem({
        actorName: "田中 太郎",
        toLabel: "是正完了",
        toStatus: "done",
      }),
    ];
    render(<Timeline issueId="i1" items={items} isLoading={false} />);
    expect(
      screen.getByText("田中 太郎が 是正完了 に変更しました"),
    ).toBeDefined();
  });

  it("コメントとステータス変更が混在表示される", () => {
    const items: TimelineItem[] = [
      makeCommentItem({ commentId: "c1", body: "是正します" }),
      makeStatusChangeItem({ toLabel: "対応中", toStatus: "in_progress" }),
    ];
    render(<Timeline issueId="i1" items={items} isLoading={false} />);
    expect(screen.getByText("是正します")).toBeDefined();
    expect(screen.getByText("田中 太郎が 対応中 に変更しました")).toBeDefined();
    expect(screen.getByText("2件")).toBeDefined();
  });
});
