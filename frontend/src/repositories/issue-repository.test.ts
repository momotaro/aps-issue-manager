import { describe, expect, it, vi } from "vitest";
import { createIssueRepository } from "./issue-repository";

/**
 * Repository 層の薄いスモークテスト。
 *
 * @remarks
 * 実 HTTP は叩かず、hono の `apiClient` 相当を `vi.fn()` で作り直して
 * 「Repository がルートを正しく組み立てているか」「エラー時に throw するか」を検証する。
 */

type MockClient = {
  api: {
    issues: {
      $get: ReturnType<typeof vi.fn>;
      $post: ReturnType<typeof vi.fn>;
      ":id": {
        $get: ReturnType<typeof vi.fn>;
        $put: ReturnType<typeof vi.fn>;
        correct: { $post: ReturnType<typeof vi.fn> };
        review: { $post: ReturnType<typeof vi.fn> };
        comments: { $post: ReturnType<typeof vi.fn> };
        photos: {
          "upload-url": { $post: ReturnType<typeof vi.fn> };
        };
      };
    };
  };
};

const makeResponse = (ok: boolean, body: unknown) => ({
  ok,
  json: async () => body,
});

const makeClient = (): MockClient => ({
  api: {
    issues: {
      $get: vi.fn(),
      $post: vi.fn(),
      ":id": {
        $get: vi.fn(),
        $put: vi.fn(),
        correct: { $post: vi.fn() },
        review: { $post: vi.fn() },
        comments: { $post: vi.fn() },
        photos: {
          "upload-url": { $post: vi.fn() },
        },
      },
    },
  },
});

describe("issueRepository", () => {
  describe("updateIssue", () => {
    it("新エンドポイント PUT /:id を単一コールで呼び、actorId をマージする", async () => {
      const client = makeClient();
      client.api.issues[":id"].$put.mockResolvedValue(
        makeResponse(true, { ok: true }),
      );
      // biome-ignore lint/suspicious/noExplicitAny: test double
      const repo = createIssueRepository(client as any);
      await repo.updateIssue(
        "issue1",
        { title: "new", category: "quality_defect" },
        "actor1",
      );
      expect(client.api.issues[":id"].$put).toHaveBeenCalledTimes(1);
      const call = client.api.issues[":id"].$put.mock.calls[0];
      expect(call[0]).toEqual({
        param: { id: "issue1" },
        json: {
          title: "new",
          category: "quality_defect",
          actorId: "actor1",
        },
      });
      expect(call[1]).toEqual({ init: { credentials: "omit" } });
    });

    it("非 2xx レスポンスで throw する", async () => {
      const client = makeClient();
      client.api.issues[":id"].$put.mockResolvedValue(
        makeResponse(false, { error: { code: "X", message: "fail" } }),
      );
      // biome-ignore lint/suspicious/noExplicitAny: test double
      const repo = createIssueRepository(client as any);
      await expect(
        repo.updateIssue("issue1", { title: "t" }, "actor1"),
      ).rejects.toThrow();
    });
  });

  describe("correctIssue", () => {
    it("POST /:id/correct を呼び attachments を渡す", async () => {
      const client = makeClient();
      client.api.issues[":id"].correct.$post.mockResolvedValue(
        makeResponse(true, { ok: true }),
      );
      // biome-ignore lint/suspicious/noExplicitAny: test double
      const repo = createIssueRepository(client as any);
      await repo.correctIssue(
        "issue1",
        {
          status: "in_review",
          comment: {
            commentId: "c1",
            body: "done",
            attachments: [
              {
                id: "p1",
                fileName: "a.jpg",
                storagePath: "pending/issue1/c1/p1.jpg",
                uploadedAt: "2026-04-10T16:30:00.000Z",
              },
            ],
          },
        },
        "actor1",
      );
      const call = client.api.issues[":id"].correct.$post.mock.calls[0];
      expect(call[0].param).toEqual({ id: "issue1" });
      expect(call[0].json.comment.attachments).toHaveLength(1);
      expect(call[0].json.actorId).toBe("actor1");
    });
  });

  describe("reviewIssue", () => {
    it("POST /:id/review を呼ぶ（approve）", async () => {
      const client = makeClient();
      client.api.issues[":id"].review.$post.mockResolvedValue(
        makeResponse(true, { ok: true }),
      );
      // biome-ignore lint/suspicious/noExplicitAny: test double
      const repo = createIssueRepository(client as any);
      await repo.reviewIssue(
        "issue1",
        { status: "done", comment: { commentId: "c1", body: "ok" } },
        "actor1",
      );
      const call = client.api.issues[":id"].review.$post.mock.calls[0];
      expect(call[0].json.status).toBe("done");
      expect(call[0].json.comment.body).toBe("ok");
    });
  });

  describe("addComment", () => {
    it("POST /:id/comments を呼ぶ", async () => {
      const client = makeClient();
      client.api.issues[":id"].comments.$post.mockResolvedValue(
        makeResponse(true, { ok: true }),
      );
      // biome-ignore lint/suspicious/noExplicitAny: test double
      const repo = createIssueRepository(client as any);
      await repo.addComment(
        "issue1",
        { comment: { commentId: "c1", body: "hi" } },
        "actor1",
      );
      const call = client.api.issues[":id"].comments.$post.mock.calls[0];
      expect(call[0].json.actorId).toBe("actor1");
    });
  });

  describe("generatePhotoUploadUrl", () => {
    it("POST /:id/photos/upload-url を呼び、storagePath を含むレスポンスを返す", async () => {
      const client = makeClient();
      client.api.issues[":id"].photos["upload-url"].$post.mockResolvedValue(
        makeResponse(true, {
          photoId: "p1",
          uploadUrl: "http://minio/upload",
          storagePath: "pending/issue1/c1/p1.jpg",
        }),
      );
      // biome-ignore lint/suspicious/noExplicitAny: test double
      const repo = createIssueRepository(client as any);
      const result = await repo.generatePhotoUploadUrl(
        "issue1",
        "c1",
        "photo.jpg",
      );
      expect(result).toEqual({
        photoId: "p1",
        uploadUrl: "http://minio/upload",
        storagePath: "pending/issue1/c1/p1.jpg",
      });
    });
  });
});
