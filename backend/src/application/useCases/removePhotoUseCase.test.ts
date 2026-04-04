import { describe, expect, it, vi } from "vitest";
import type { Issue } from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import { NotFoundError } from "../../domain/services/errors.js";
import {
  generateId,
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

const existingPhoto = createPhoto({
  id: photoId,
  fileName: "crack.jpg",
  storagePath: `confirmed/${issueId}/before/${photoId}.jpg`,
  phase: "before",
  uploadedAt: new Date("2026-01-01"),
});

const issueWithPhoto: Issue = Object.freeze({
  id: issueId,
  projectId: parseId<ProjectId>("019560a0-0000-7000-8000-000000001000"),
  title: "テスト指摘",
  description: "テスト用",
  status: "open" as const,
  category: "quality_defect" as const,
  position: createSpatialPosition(0, 0, 0),
  reporterId: actorId,
  assigneeId: null,
  photos: [existingPhoto],
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
  load: vi.fn().mockResolvedValue(issueWithPhoto),
  save: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  ...overrides,
});

const createMockBlobStorage = (
  overrides?: Partial<BlobStorage>,
): BlobStorage => ({
  uploadPending: vi.fn(),
  generateUploadUrl: vi.fn(),
  confirmPending: vi.fn(),
  deletePhoto: vi.fn().mockResolvedValue(undefined),
  deleteByIssue: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("removePhotoUseCase", () => {
  it("PhotoRemoved イベント保存後に Blob を削除する", async () => {
    const issueRepo = createMockIssueRepo();
    const blobStorage = createMockBlobStorage();
    const useCase = removePhotoUseCase(issueRepo, blobStorage);

    await useCase({ issueId, photoId, actorId });

    // save が PhotoRemoved イベントで呼ばれた
    expect(issueRepo.save).toHaveBeenCalledWith(
      issueId,
      [
        expect.objectContaining({
          type: "PhotoRemoved",
          payload: expect.objectContaining({ photoId }),
        }),
      ],
      issueWithPhoto.version,
    );

    // save の後に deletePhoto が呼ばれた
    expect(blobStorage.deletePhoto).toHaveBeenCalledWith(
      existingPhoto.storagePath,
    );
  });

  it("存在しない Issue で NotFoundError をスローする", async () => {
    const issueRepo = createMockIssueRepo({
      load: vi.fn().mockResolvedValue(null),
    });
    const blobStorage = createMockBlobStorage();
    const useCase = removePhotoUseCase(issueRepo, blobStorage);

    await expect(useCase({ issueId, photoId, actorId })).rejects.toThrow(
      NotFoundError,
    );

    expect(issueRepo.save).not.toHaveBeenCalled();
    expect(blobStorage.deletePhoto).not.toHaveBeenCalled();
  });

  it("存在しない写真 ID で NotFoundError をスローする", async () => {
    const issueRepo = createMockIssueRepo();
    const blobStorage = createMockBlobStorage();
    const useCase = removePhotoUseCase(issueRepo, blobStorage);

    const unknownPhotoId = generateId<PhotoId>();

    await expect(
      useCase({ issueId, photoId: unknownPhotoId, actorId }),
    ).rejects.toThrow(NotFoundError);

    expect(issueRepo.save).not.toHaveBeenCalled();
    expect(blobStorage.deletePhoto).not.toHaveBeenCalled();
  });

  it("イベント保存が先、Blob 削除が後の順序で実行される", async () => {
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
});
