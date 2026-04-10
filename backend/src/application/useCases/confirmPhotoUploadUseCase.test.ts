import { describe, expect, it, vi } from "vitest";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import {
  type IssueId,
  type PhotoId,
  parseId,
} from "../../domain/valueObjects/brandedId.js";
import { createPhoto, type Photo } from "../../domain/valueObjects/photo.js";
import { confirmPhotoUploadUseCase } from "./confirmPhotoUploadUseCase.js";

// ---------------------------------------------------------------------------
// テスト用データ
// ---------------------------------------------------------------------------

const issueId = parseId<IssueId>("019560a0-0000-7000-8000-000000000001");
const photoId = parseId<PhotoId>("019560a0-0000-7000-8000-000000000010");

// ---------------------------------------------------------------------------
// モック
// ---------------------------------------------------------------------------

const createMockBlobStorage = (
  overrides?: Partial<BlobStorage>,
): BlobStorage => ({
  generateUploadUrl: vi.fn().mockResolvedValue({ uploadUrl: "http://test" }),
  confirmPending: vi
    .fn()
    .mockImplementation((_issueId: string, photos: readonly Photo[]) =>
      Promise.resolve(
        photos.map((p) =>
          createPhoto({
            id: p.id,
            fileName: p.fileName,
            storagePath: `confirmed/${_issueId}/${p.id}.jpg`,
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
  it("pending→confirmed 移動を実行する", async () => {
    const blobStorage = createMockBlobStorage();
    const useCase = confirmPhotoUploadUseCase(blobStorage);

    const photos: readonly Photo[] = [
      createPhoto({
        id: photoId,
        fileName: "crack.jpg",
        storagePath: `pending/${issueId}/${photoId}.jpg`,
        uploadedAt: new Date(),
      }),
    ];

    const result = await useCase({ issueId, photos });

    expect(result.ok).toBe(true);
    expect(blobStorage.confirmPending).toHaveBeenCalledWith(issueId, photos);
  });

  it("写真が空の場合は confirmPending を呼ばずに成功を返す", async () => {
    const blobStorage = createMockBlobStorage();
    const useCase = confirmPhotoUploadUseCase(blobStorage);

    const result = await useCase({ issueId, photos: [] });

    expect(result.ok).toBe(true);
    expect(blobStorage.confirmPending).not.toHaveBeenCalled();
  });

  it("confirmPending が失敗した場合、CONFIRM_FAILED エラーを返す", async () => {
    const blobStorage = createMockBlobStorage({
      confirmPending: vi.fn().mockRejectedValue(new Error("S3 move failed")),
    });
    const useCase = confirmPhotoUploadUseCase(blobStorage);

    const photos: readonly Photo[] = [
      createPhoto({
        id: photoId,
        fileName: "crack.jpg",
        storagePath: `pending/${issueId}/${photoId}.jpg`,
        uploadedAt: new Date(),
      }),
    ];

    const result = await useCase({ issueId, photos });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFIRM_FAILED");
      expect(result.error.message).toContain("S3 move failed");
    }
  });
});
