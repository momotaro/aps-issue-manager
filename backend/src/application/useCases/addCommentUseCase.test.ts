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
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { addCommentUseCase } from "./addCommentUseCase.js";

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

describe("addCommentUseCase", () => {
  it("コメントを追加できる", async () => {
    const issue = makeIssue();
    const repo = mockRepo(issue);
    const useCase = addCommentUseCase(repo, mockBlobStorage);

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "質問があります",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.event.type).toBe("CommentAdded");
    expect(result.value.event.payload.comment.body).toBe("質問があります");
  });

  it("attachments 付きコメントを追加でき、confirmPending が呼ばれる", async () => {
    const issue = makeIssue();
    const repo = mockRepo(issue);
    const blob = {
      ...mockBlobStorage,
      confirmPending: vi.fn().mockResolvedValue([]),
    };
    const useCase = addCommentUseCase(repo, blob);
    const commentId = generateId<CommentId>();

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId,
        body: "写真を添付します",
        attachments: [
          {
            id: generateId<PhotoId>(),
            fileName: "photo.jpg",
            storagePath: `pending/${issue.id}/${commentId}/photo1.jpg`,
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
    const useCase = addCommentUseCase(repo, mockBlobStorage);

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

  it("コメント本文が空の場合 EMPTY_COMMENT を返す", async () => {
    const issue = makeIssue();
    const repo = mockRepo(issue);
    const useCase = addCommentUseCase(repo, mockBlobStorage);

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("EMPTY_COMMENT");
  });

  it("confirmPending が失敗した場合 CONFIRM_FAILED を返す", async () => {
    const issue = makeIssue();
    const repo = mockRepo(issue);
    const blob = {
      ...mockBlobStorage,
      confirmPending: vi.fn().mockRejectedValue(new Error("MinIO down")),
    };
    const useCase = addCommentUseCase(repo, blob);
    const commentId = generateId<CommentId>();

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId,
        body: "写真添付テスト",
        attachments: [
          {
            id: generateId<PhotoId>(),
            fileName: "photo.jpg",
            storagePath: `pending/${issue.id}/${commentId}/photo1.jpg`,
            uploadedAt: new Date(),
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CONFIRM_FAILED");
  });
});
