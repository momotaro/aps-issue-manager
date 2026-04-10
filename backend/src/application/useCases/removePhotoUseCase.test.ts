import { describe, expect, it, vi } from "vitest";
import type { Issue } from "../../domain/entities/issue.js";
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
import { removePhotoUseCase } from "./removePhotoUseCase.js";

// ---------------------------------------------------------------------------
// テスト用データ
// ---------------------------------------------------------------------------

const issueId = parseId<IssueId>("019560a0-0000-7000-8000-000000000001");
const photoId = parseId<PhotoId>("019560a0-0000-7000-8000-000000000010");
const actorId = parseId<UserId>("019560a0-0000-7000-8000-000000000100");

const photo = createPhoto({
  id: photoId,
  fileName: "crack.jpg",
  storagePath: `confirmed/${issueId}/before/${photoId}.jpg`,
  phase: "before",
  uploadedAt: new Date("2026-01-01"),
});

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
  photos: [photo],
  comments: [],
  version: 2,
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
  generateUploadUrl: vi.fn().mockResolvedValue({ uploadUrl: "http://test" }),
  confirmPending: vi.fn(),
  deletePhoto: vi.fn().mockResolvedValue(undefined),
  deleteByIssue: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("removePhotoUseCase", () => {
  it("正常系: PhotoRemoved イベント保存 + Blob 削除", async () => {
    const issueRepo = createMockIssueRepo();
    const blobStorage = createMockBlobStorage();
    const useCase = removePhotoUseCase(issueRepo, blobStorage);

    const result = await useCase({ issueId, photoId, actorId });

    expect(result.ok).toBe(true);
    expect(issueRepo.save).toHaveBeenCalledWith(
      issueId,
      [
        expect.objectContaining({
          type: "PhotoRemoved",
          payload: expect.objectContaining({ photoId }),
        }),
      ],
      baseIssue.version,
    );
    expect(blobStorage.deletePhoto).toHaveBeenCalledWith(photo.storagePath);
  });

  it("正常系: イベント保存が Blob 削除より先に実行される", async () => {
    const callOrder: string[] = [];
    const issueRepo = createMockIssueRepo({
      save: vi.fn().mockImplementation(async () => {
        callOrder.push("save");
      }),
    });
    const blobStorage = createMockBlobStorage({
      deletePhoto: vi.fn().mockImplementation(async () => {
        callOrder.push("deletePhoto");
      }),
    });
    const useCase = removePhotoUseCase(issueRepo, blobStorage);

    await useCase({ issueId, photoId, actorId });

    expect(callOrder).toEqual(["save", "deletePhoto"]);
  });

  it("異常系: 存在しない Issue で ISSUE_NOT_FOUND エラーを返す", async () => {
    const issueRepo = createMockIssueRepo({
      load: vi.fn().mockResolvedValue(null),
    });
    const blobStorage = createMockBlobStorage();
    const useCase = removePhotoUseCase(issueRepo, blobStorage);

    const result = await useCase({ issueId, photoId, actorId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ISSUE_NOT_FOUND");
    }
    expect(issueRepo.save).not.toHaveBeenCalled();
    expect(blobStorage.deletePhoto).not.toHaveBeenCalled();
  });

  it("異常系: 存在しない写真で PHOTO_NOT_FOUND エラーを返す", async () => {
    const unknownPhotoId = parseId<PhotoId>(
      "019560a0-0000-7000-8000-000000000099",
    );
    const issueRepo = createMockIssueRepo();
    const blobStorage = createMockBlobStorage();
    const useCase = removePhotoUseCase(issueRepo, blobStorage);

    const result = await useCase({
      issueId,
      photoId: unknownPhotoId,
      actorId,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PHOTO_NOT_FOUND");
    }
    expect(issueRepo.save).not.toHaveBeenCalled();
    expect(blobStorage.deletePhoto).not.toHaveBeenCalled();
  });
});
