import { describe, expect, it, vi } from "vitest";
import { applyEvent, createIssue } from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import {
  type CommentId,
  generateId,
  type IssueId,
  type ProjectId,
  parseId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { deleteIssueUseCase } from "./deleteIssueUseCase.js";

// ---------------------------------------------------------------------------
// テスト用ヘルパー
// ---------------------------------------------------------------------------

const actorId = parseId<UserId>("01ACTOR000000000000000ACTOR");
const projectId = parseId<ProjectId>("01PROJ0000000000000000PROJ0");
const reporterId = parseId<UserId>("01REPORTER00000000000REPORT");

/** テスト用の Issue 状態を生成する */
const makeIssue = () => {
  const result = createIssue({
    issueId: generateId<IssueId>(),
    projectId,
    title: "壁のひび割れ",
    category: "quality_defect" as const,
    position: createSpatialPosition(10, 20, 30),
    reporterId,
    assigneeId: null,
    actorId,
    comment: {
      commentId: generateId<CommentId>(),
      body: "3階東側の壁にひび割れを確認",
    },
  });
  if (!result.ok) throw new Error("createIssue failed");
  const [createdEvent, commentEvent] = result.value;
  const state = applyEvent(null, createdEvent);
  return applyEvent(state, commentEvent);
};

/** IssueRepository のモック生成 */
const createMockRepo = (
  overrides: Partial<IssueRepository> = {},
): IssueRepository => ({
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
  getSnapshot: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

/** BlobStorage のモック生成 */
const createMockBlobStorage = (
  overrides: Partial<BlobStorage> = {},
): BlobStorage => ({
  confirmPending: vi.fn().mockResolvedValue([]),
  deleteByIssue: vi.fn().mockResolvedValue(undefined),
  generateUploadUrl: vi.fn().mockResolvedValue({ uploadUrl: "http://test" }),
  deletePhoto: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("deleteIssueUseCase", () => {
  it("正常系: 指摘を削除する", async () => {
    const issue = makeIssue();
    const repo = createMockRepo({ load: vi.fn().mockResolvedValue(issue) });
    const blobStorage = createMockBlobStorage();
    const useCase = deleteIssueUseCase(repo, blobStorage);

    const result = await useCase({ issueId: issue.id });

    expect(result.ok).toBe(true);
    expect(blobStorage.deleteByIssue).toHaveBeenCalledWith(issue.id);
    expect(repo.delete).toHaveBeenCalledWith(issue.id);
  });

  it("正常系: DB 削除が先に実行され、その後 Blob 削除が実行される", async () => {
    const issue = makeIssue();
    const callOrder: string[] = [];

    const repo = createMockRepo({
      load: vi.fn().mockResolvedValue(issue),
      delete: vi.fn().mockImplementation(async () => {
        callOrder.push("repo.delete");
      }),
    });
    const blobStorage = createMockBlobStorage({
      deleteByIssue: vi.fn().mockImplementation(async () => {
        callOrder.push("blob.deleteByIssue");
      }),
    });
    const useCase = deleteIssueUseCase(repo, blobStorage);

    await useCase({ issueId: issue.id });

    expect(callOrder).toEqual(["repo.delete", "blob.deleteByIssue"]);
  });

  it("正常系: Blob 削除失敗でも成功を返す（非致命的）", async () => {
    const issue = makeIssue();
    const repo = createMockRepo({ load: vi.fn().mockResolvedValue(issue) });
    const blobStorage = createMockBlobStorage({
      deleteByIssue: vi.fn().mockRejectedValue(new Error("S3 error")),
    });
    const useCase = deleteIssueUseCase(repo, blobStorage);

    const result = await useCase({ issueId: issue.id });

    expect(result.ok).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith(issue.id);
  });

  it("異常系: 存在しない Issue でエラーを返す", async () => {
    const repo = createMockRepo();
    const blobStorage = createMockBlobStorage();
    const useCase = deleteIssueUseCase(repo, blobStorage);
    const issueId = parseId<IssueId>("01ISSUE000000000000000ISSUE");

    const result = await useCase({ issueId });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("ISSUE_NOT_FOUND");
    expect(blobStorage.deleteByIssue).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
