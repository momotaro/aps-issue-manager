import { describe, expect, it, vi } from "vitest";
import { applyEvent, createIssue } from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import {
  type IssueId,
  type PhotoId,
  type ProjectId,
  parseId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createPhoto } from "../../domain/valueObjects/photo.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { deleteIssueUseCase } from "./deleteIssueUseCase.js";

// ---------------------------------------------------------------------------
// テスト用ヘルパー
// ---------------------------------------------------------------------------

const actorId = parseId<UserId>("01ACTOR000000000000000ACTOR");
const projectId = parseId<ProjectId>("01PROJ0000000000000000PROJ0");
const reporterId = parseId<UserId>("01REPORTER00000000000REPORT");

/** テスト用の Issue 状態を生成する（写真なし） */
const makeIssue = () => {
  const result = createIssue({
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
  if (!result.ok) throw new Error("createIssue failed");
  return applyEvent(null, result.value);
};

/** テスト用の Issue 状態を生成する（写真あり） */
const makeIssueWithPhotos = () => {
  const result = createIssue({
    projectId,
    title: "壁のひび割れ",
    description: "3階東側の壁にひび割れを確認",
    category: "quality_defect" as const,
    position: createSpatialPosition(10, 20, 30),
    reporterId,
    assigneeId: null,
    photos: [
      createPhoto({
        id: parseId<PhotoId>("01PHOTO000000000000000PHOTO"),
        fileName: "photo1.jpg",
        storagePath: "confirmed/issue1/before/photo1.jpg",
        phase: "before",
        uploadedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ],
    actorId,
  });
  if (!result.ok) throw new Error("createIssue failed");
  return applyEvent(null, result.value);
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
  uploadPending: vi.fn().mockResolvedValue("pending/test"),
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
  it("正常系: 指摘を削除する（写真なし）", async () => {
    const issue = makeIssue();
    const repo = createMockRepo({ load: vi.fn().mockResolvedValue(issue) });
    const blobStorage = createMockBlobStorage();
    const useCase = deleteIssueUseCase(repo, blobStorage);

    const result = await useCase({ issueId: issue.id });

    expect(result.ok).toBe(true);
    expect(blobStorage.deleteByIssue).toHaveBeenCalledWith(issue.id);
    expect(repo.delete).toHaveBeenCalledWith(issue.id);
  });

  it("正常系: 写真がある指摘を削除する（Blob も削除される）", async () => {
    const issue = makeIssueWithPhotos();
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
