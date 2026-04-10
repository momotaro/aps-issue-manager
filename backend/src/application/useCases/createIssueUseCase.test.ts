import { describe, expect, it, vi } from "vitest";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import {
  type CommentId,
  generateId,
  type IssueId,
  type PhotoId,
  type ProjectId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { COMMENT_MAX_LENGTH } from "../../domain/valueObjects/comment.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import type { CreateIssueInput } from "./createIssueUseCase.js";
import { createIssueUseCase } from "./createIssueUseCase.js";

// ---------------------------------------------------------------------------
// テストヘルパー
// ---------------------------------------------------------------------------

const mockIssueRepo = (
  overrides?: Partial<IssueRepository>,
): IssueRepository => ({
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
  getSnapshot: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const mockBlobStorage: BlobStorage = {
  generateUploadUrl: vi.fn(),
  confirmPending: vi.fn().mockResolvedValue([]),
  deleteByIssue: vi.fn(),
  deletePhoto: vi.fn(),
};

const makeValidInput = (): CreateIssueInput => ({
  issueId: generateId<IssueId>(),
  projectId: "project-1" as ProjectId,
  title: "外壁タイルの浮き",
  category: "quality_defect",
  position: createSpatialPosition(1.0, 2.0, 3.0),
  reporterId: "user-1" as UserId,
  comment: {
    commentId: generateId<CommentId>(),
    body: "北側外壁3階部分にタイルの浮きを確認",
  },
});

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("createIssueUseCase", () => {
  describe("正常系", () => {
    it("指摘を作成し、IssueCreated + CommentAdded イベントを返す", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo, mockBlobStorage);

      const result = await useCase(makeValidInput());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.events).toHaveLength(2);
      expect(result.value.events[0].type).toBe("IssueCreated");
      expect(result.value.events[0].payload.title).toBe("外壁タイルの浮き");
      expect(result.value.events[0].payload.projectId).toBe("project-1");
      expect(result.value.events[0].payload.status).toBe("open");
      expect(result.value.events[1].type).toBe("CommentAdded");
      expect(result.value.issueId).toBe(result.value.events[0].issueId);
    });

    it("save が version 0 で呼ばれ、2イベントが保存される（新規集約）", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo, mockBlobStorage);

      const result = await useCase(makeValidInput());
      if (!result.ok) return;

      expect(repo.save).toHaveBeenCalledWith(
        result.value.issueId,
        result.value.events,
        0,
      );
    });

    it("assigneeId を指定した場合、イベントに含まれる", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo, mockBlobStorage);

      const result = await useCase({
        ...makeValidInput(),
        assigneeId: "user-2" as UserId,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.events[0].payload.assigneeId).toBe("user-2");
    });

    it("assigneeId を省略した場合、null になる", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo, mockBlobStorage);

      const result = await useCase(makeValidInput());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.events[0].payload.assigneeId).toBeNull();
    });

    it("attachments 付きで作成すると confirmed パスでイベントに記録される", async () => {
      const repo = mockIssueRepo();
      const blob = {
        ...mockBlobStorage,
        confirmPending: vi.fn().mockResolvedValue([]),
      };
      const useCase = createIssueUseCase(repo, blob);
      const commentId = generateId<CommentId>();
      const photoId = generateId<PhotoId>();
      const issueId = generateId<IssueId>();

      const result = await useCase({
        ...makeValidInput(),
        issueId,
        comment: {
          commentId,
          body: "写真付き指摘",
          attachments: [
            {
              id: photoId,
              fileName: "photo.jpg",
              storagePath: `pending/${issueId}/${commentId}/${photoId}.jpg`,
              uploadedAt: new Date(),
            },
          ],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const comment = result.value.events[1].payload.comment;
      expect(comment.attachments[0].storagePath).toContain("confirmed/");
      expect(blob.confirmPending).toHaveBeenCalled();
    });
  });

  describe("異常系", () => {
    it("タイトルが空の場合、EMPTY_TITLE エラーを返す", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo, mockBlobStorage);

      const result = await useCase({ ...makeValidInput(), title: "" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("EMPTY_TITLE");
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("タイトルが空白のみの場合、EMPTY_TITLE エラーを返す", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo, mockBlobStorage);

      const result = await useCase({ ...makeValidInput(), title: "   " });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("EMPTY_TITLE");
    });

    it("コメント本文が最大文字数を超過した場合、BODY_TOO_LONG を返す", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo, mockBlobStorage);

      const result = await useCase({
        ...makeValidInput(),
        comment: {
          commentId: generateId<CommentId>(),
          body: "a".repeat(COMMENT_MAX_LENGTH + 1),
        },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("BODY_TOO_LONG");
    });

    it("save が失敗した場合、SAVE_FAILED エラーを返す", async () => {
      const repo = mockIssueRepo({
        save: vi.fn().mockRejectedValue(new Error("DB connection failed")),
      });
      const useCase = createIssueUseCase(repo, mockBlobStorage);

      const result = await useCase(makeValidInput());

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("SAVE_FAILED");
      expect(result.error.message).toContain("DB connection failed");
    });
  });
});
