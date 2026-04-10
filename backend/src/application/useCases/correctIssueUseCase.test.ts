import { describe, expect, it, vi } from "vitest";
import { applyEvent, createIssue } from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import {
  type CommentId,
  generateId,
  type IssueId,
  type PhotoId,
  type ProjectId,
  parseId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { COMMENT_MAX_LENGTH } from "../../domain/valueObjects/comment.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { correctIssueUseCase } from "./correctIssueUseCase.js";

const actorId = parseId<UserId>("01ACTOR000000000000000ACTOR");
const projectId = parseId<ProjectId>("01PROJ0000000000000000PROJ0");

const makeIssue = () => {
  const issueId = generateId<IssueId>();
  const result = createIssue({
    issueId,
    projectId,
    title: "テスト指摘",
    category: "quality_defect",
    position: createSpatialPosition(1, 2, 3),
    reporterId: actorId,
    assigneeId: null,
    actorId,
    comment: {
      commentId: generateId<CommentId>(),
      body: "初回コメント",
    },
  });
  if (!result.ok) throw new Error("createIssue failed");
  return applyEvent(applyEvent(null, result.value[0]), result.value[1]);
};

const mockRepo = (
  issue: ReturnType<typeof makeIssue> | null = null,
): IssueRepository => ({
  load: vi.fn().mockResolvedValue(issue),
  save: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  delete: vi.fn(),
});

const mockBlobStorage: BlobStorage = {
  generateUploadUrl: vi.fn(),
  confirmPending: vi.fn().mockResolvedValue([]),
  deleteByIssue: vi.fn(),
  deletePhoto: vi.fn(),
};

describe("correctIssueUseCase", () => {
  it("ステータス遷移 + コメント追加を1トランザクションで保存する", async () => {
    const issue = makeIssue();
    const repo = mockRepo(issue);
    const useCase = correctIssueUseCase(repo, mockBlobStorage);

    const result = await useCase({
      issueId: issue.id,
      status: "in_progress",
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "是正開始します",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events).toHaveLength(2);
    expect(result.value.events[0].type).toBe("IssueStatusChanged");
    expect(result.value.events[1].type).toBe("CommentAdded");
    expect(repo.save).toHaveBeenCalledWith(
      issue.id,
      expect.any(Array),
      issue.version,
    );
    const savedEvents = (repo.save as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
    expect(savedEvents).toHaveLength(2);
  });

  it("ステータスなし + コメントのみ追加できる", async () => {
    const issue = makeIssue();
    const repo = mockRepo(issue);
    const useCase = correctIssueUseCase(repo, mockBlobStorage);

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "追加情報です",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events).toHaveLength(1);
    expect(result.value.events[0].type).toBe("CommentAdded");
  });

  it("コメントに画像を添付できる", async () => {
    const issue = makeIssue();
    const repo = mockRepo(issue);
    const blob = {
      ...mockBlobStorage,
      confirmPending: vi.fn().mockResolvedValue([]),
    };
    const useCase = correctIssueUseCase(repo, blob);
    const commentId = generateId<CommentId>();
    const photoId = generateId<PhotoId>();

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId,
        body: "是正後の写真",
        attachments: [
          {
            id: photoId,
            fileName: "photo.jpg",
            storagePath: `pending/${issue.id}/${commentId}/${photoId}.jpg`,
            uploadedAt: new Date(),
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(blob.confirmPending).toHaveBeenCalledWith(
      issue.id,
      expect.any(Array),
    );
  });

  it("Issue が存在しない場合 ISSUE_NOT_FOUND を返す", async () => {
    const repo = mockRepo(null);
    const useCase = correctIssueUseCase(repo, mockBlobStorage);

    const result = await useCase({
      issueId: generateId<IssueId>(),
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "テスト",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("ISSUE_NOT_FOUND");
  });

  it("無効なステータス遷移はエラーを返す", async () => {
    const issue = makeIssue(); // status: open
    const repo = mockRepo(issue);
    const useCase = correctIssueUseCase(repo, mockBlobStorage);

    const result = await useCase({
      issueId: issue.id,
      status: "done", // open → done は無効
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "テスト",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });

  it("コメント本文が空の場合 EMPTY_COMMENT を返す", async () => {
    const issue = makeIssue();
    const repo = mockRepo(issue);
    const useCase = correctIssueUseCase(repo, mockBlobStorage);

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "   ",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("EMPTY_COMMENT");
  });

  it("コメント本文が最大文字数を超過した場合 BODY_TOO_LONG を返す", async () => {
    const issue = makeIssue();
    const repo = mockRepo(issue);
    const useCase = correctIssueUseCase(repo, mockBlobStorage);

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "a".repeat(COMMENT_MAX_LENGTH + 1),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("BODY_TOO_LONG");
  });

  it("コメント本文がちょうど最大文字数なら成功する", async () => {
    const issue = makeIssue();
    const repo = mockRepo(issue);
    const useCase = correctIssueUseCase(repo, mockBlobStorage);

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "a".repeat(COMMENT_MAX_LENGTH),
      },
    });

    expect(result.ok).toBe(true);
  });

  it("ConcurrencyError の場合 CONCURRENCY_CONFLICT を返す", async () => {
    const issue = makeIssue();
    const { ConcurrencyError } = await import(
      "../../domain/services/errors.js"
    );
    const repo = mockRepo(issue);
    (repo.save as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ConcurrencyError(issue.id, 2, 3),
    );
    const useCase = correctIssueUseCase(repo, mockBlobStorage);

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "テスト",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CONCURRENCY_CONFLICT");
  });
});
