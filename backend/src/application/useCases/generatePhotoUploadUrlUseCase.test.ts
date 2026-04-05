import { describe, expect, it, vi } from "vitest";
import type { Issue } from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import {
  type IssueId,
  type ProjectId,
  parseId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { generatePhotoUploadUrlUseCase } from "./generatePhotoUploadUrlUseCase.js";

// ---------------------------------------------------------------------------
// テスト用データ
// ---------------------------------------------------------------------------

const issueId = parseId<IssueId>("019560a0-0000-7000-8000-000000000001");
const actorId = parseId<UserId>("019560a0-0000-7000-8000-000000000100");

const baseIssue: Issue = Object.freeze({
  id: issueId,
  projectId: parseId<ProjectId>("019560a0-0000-7000-8000-000000001000"),
  title: "テスト指摘",
  description: "テスト用",
  status: "open" as const,
  category: "quality_defect" as const,
  position: createSpatialPosition(0, 0, 0),
  reporterId: actorId,
  assigneeId: null,
  photos: [],
  version: 1,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});

// ---------------------------------------------------------------------------
// モック
// ---------------------------------------------------------------------------

const createMockIssueRepo = (
  overrides?: Partial<IssueRepository>,
): IssueRepository => ({
  load: vi.fn().mockResolvedValue(baseIssue),
  save: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  delete: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const createMockBlobStorage = (
  overrides?: Partial<BlobStorage>,
): BlobStorage => ({
  generateUploadUrl: vi.fn().mockResolvedValue({
    uploadUrl: "https://minio.example.com/presigned-url",
  }),
  confirmPending: vi.fn(),
  deletePhoto: vi.fn(),
  deleteByIssue: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("generatePhotoUploadUrlUseCase", () => {
  it("photoId を生成し Presigned URL を返す", async () => {
    const issueRepo = createMockIssueRepo();
    const blobStorage = createMockBlobStorage();
    const useCase = generatePhotoUploadUrlUseCase(issueRepo, blobStorage);

    const result = await useCase({
      issueId,
      fileName: "crack.jpg",
      phase: "before",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.photoId).toBeDefined();
    expect(typeof result.value.photoId).toBe("string");
    expect(result.value.uploadUrl).toBe(
      "https://minio.example.com/presigned-url",
    );

    expect(blobStorage.generateUploadUrl).toHaveBeenCalledWith(
      issueId,
      result.value.photoId,
      "crack.jpg",
      "before",
    );
  });

  it("phase: after でも正しく動作する", async () => {
    const issueRepo = createMockIssueRepo();
    const blobStorage = createMockBlobStorage();
    const useCase = generatePhotoUploadUrlUseCase(issueRepo, blobStorage);

    const result = await useCase({
      issueId,
      fileName: "fixed.png",
      phase: "after",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(blobStorage.generateUploadUrl).toHaveBeenCalledWith(
      issueId,
      result.value.photoId,
      "fixed.png",
      "after",
    );
  });

  it("存在しない Issue で ISSUE_NOT_FOUND エラーを返す", async () => {
    const issueRepo = createMockIssueRepo({
      load: vi.fn().mockResolvedValue(null),
    });
    const blobStorage = createMockBlobStorage();
    const useCase = generatePhotoUploadUrlUseCase(issueRepo, blobStorage);

    const result = await useCase({
      issueId,
      fileName: "test.jpg",
      phase: "before",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ISSUE_NOT_FOUND");
    }
    expect(blobStorage.generateUploadUrl).not.toHaveBeenCalled();
  });
});
