import { describe, expect, it, vi } from "vitest";
import type { Issue } from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import { NotFoundError } from "../../domain/services/errors.js";
import {
  type IssueId,
  type PhotoId,
  type ProjectId,
  parseId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createPhoto, type Photo } from "../../domain/valueObjects/photo.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { confirmPhotoUploadUseCase } from "./confirmPhotoUploadUseCase.js";

// ---------------------------------------------------------------------------
// テスト用データ
// ---------------------------------------------------------------------------

const issueId = parseId<IssueId>("019560a0-0000-7000-8000-000000000001");
const photoId = parseId<PhotoId>("019560a0-0000-7000-8000-000000000010");
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
  ...overrides,
});

const createMockBlobStorage = (
  overrides?: Partial<BlobStorage>,
): BlobStorage => ({
  uploadPending: vi.fn(),
  generateUploadUrl: vi.fn(),
  confirmPending: vi
    .fn()
    .mockImplementation((_issueId: string, photos: readonly Photo[]) =>
      Promise.resolve(
        photos.map((p) =>
          createPhoto({
            id: p.id,
            fileName: p.fileName,
            storagePath: `confirmed/${_issueId}/${p.phase}/${p.id}.jpg`,
            phase: p.phase,
            uploadedAt: new Date(),
          }),
        ),
      ),
    ),
  deletePhoto: vi.fn(),
  deleteByIssue: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("confirmPhotoUploadUseCase", () => {
  it("pending→confirmed 移動 + PhotoAdded イベント保存", async () => {
    const issueRepo = createMockIssueRepo();
    const blobStorage = createMockBlobStorage();
    const useCase = confirmPhotoUploadUseCase(issueRepo, blobStorage);

    await useCase({
      issueId,
      photoId,
      fileName: "crack.jpg",
      phase: "before",
      actorId,
    });

    // confirmPending が呼ばれた
    expect(blobStorage.confirmPending).toHaveBeenCalledWith(
      issueId,
      expect.arrayContaining([
        expect.objectContaining({
          id: photoId,
          fileName: "crack.jpg",
          phase: "before",
        }),
      ]),
    );

    // save が PhotoAdded イベントで呼ばれた
    expect(issueRepo.save).toHaveBeenCalledWith(
      issueId,
      [
        expect.objectContaining({
          type: "PhotoAdded",
          payload: expect.objectContaining({
            photo: expect.objectContaining({
              id: photoId,
              phase: "before",
            }),
          }),
        }),
      ],
      baseIssue.version,
    );
  });

  it("存在しない Issue で NotFoundError をスローする", async () => {
    const issueRepo = createMockIssueRepo({
      load: vi.fn().mockResolvedValue(null),
    });
    const blobStorage = createMockBlobStorage();
    const useCase = confirmPhotoUploadUseCase(issueRepo, blobStorage);

    await expect(
      useCase({
        issueId,
        photoId,
        fileName: "crack.jpg",
        phase: "before",
        actorId,
      }),
    ).rejects.toThrow(NotFoundError);

    // confirmPending / save が呼ばれていない
    expect(blobStorage.confirmPending).not.toHaveBeenCalled();
    expect(issueRepo.save).not.toHaveBeenCalled();
  });

  it("重複する photoId でエラーをスローする", async () => {
    const existingPhoto = createPhoto({
      id: photoId,
      fileName: "existing.jpg",
      storagePath: `confirmed/${issueId}/before/${photoId}.jpg`,
      phase: "before",
      uploadedAt: new Date(),
    });
    const issueWithPhoto: Issue = {
      ...baseIssue,
      photos: [existingPhoto],
    };
    const issueRepo = createMockIssueRepo({
      load: vi.fn().mockResolvedValue(issueWithPhoto),
    });
    const blobStorage = createMockBlobStorage();
    const useCase = confirmPhotoUploadUseCase(issueRepo, blobStorage);

    await expect(
      useCase({
        issueId,
        photoId,
        fileName: "crack.jpg",
        phase: "before",
        actorId,
      }),
    ).rejects.toThrow(/already exists/);
  });
});
