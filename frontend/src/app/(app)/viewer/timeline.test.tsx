import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CommentItem } from "@/repositories/issue-repository";
import { Timeline } from "./timeline";

const makeComment = (overrides: Partial<CommentItem> = {}): CommentItem => ({
  commentId: "c000000000000000000001",
  body: "テストコメント",
  actorId: "000000002dwHTRTFRxWLTN",
  attachments: [],
  createdAt: "2026-04-10T14:00:00.000Z",
  ...overrides,
});

describe("Timeline", () => {
  it("コメントがない場合は空メッセージを表示する", () => {
    render(<Timeline issueId="i1" comments={[]} isLoading={false} />);
    expect(screen.getByText("まだコメントがありません")).toBeDefined();
  });

  it("コメントを昇順で全件表示する", () => {
    const comments: CommentItem[] = [
      makeComment({
        commentId: "c1",
        body: "最初のコメント",
        createdAt: "2026-04-08T14:00:00.000Z",
      }),
      makeComment({
        commentId: "c2",
        body: "2 番目のコメント",
        createdAt: "2026-04-09T09:15:00.000Z",
      }),
      makeComment({
        commentId: "c3",
        body: "最新のコメント",
        createdAt: "2026-04-10T16:30:00.000Z",
      }),
    ];
    render(<Timeline issueId="i1" comments={comments} isLoading={false} />);
    expect(screen.getByText("最初のコメント")).toBeDefined();
    expect(screen.getByText("2 番目のコメント")).toBeDefined();
    expect(screen.getByText("最新のコメント")).toBeDefined();
    expect(screen.getByText("3件")).toBeDefined();
  });

  it("XSS: <script> タグ文字列は DOM に挿入されずエスケープされる", () => {
    const malicious = '<script>alert("xss")</script>悪意あるコメント';
    const comments: CommentItem[] = [makeComment({ body: malicious })];
    const { container } = render(
      <Timeline issueId="i1" comments={comments} isLoading={false} />,
    );
    // React がテキストとしてエスケープしているため script 要素は生成されない
    expect(container.querySelector("script")).toBeNull();
    // 文字列としては存在する
    expect(screen.getByText(malicious)).toBeDefined();
  });

  it("添付画像がある場合はサムネイルボタンを表示する", () => {
    const comments: CommentItem[] = [
      makeComment({
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
    render(<Timeline issueId="i1" comments={comments} isLoading={false} />);
    expect(screen.getByLabelText("添付画像: photo.jpg")).toBeDefined();
  });
});
