import { describe, expect, it, vi } from "vitest";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import { type IssueId, parseId } from "../../domain/valueObjects/brandedId.js";
import { generatePhotoUploadUrlUseCase } from "./generatePhotoUploadUrlUseCase.js";

// ---------------------------------------------------------------------------
// モック
// ---------------------------------------------------------------------------

const createMockBlobStorage = (
  overrides?: Partial<BlobStorage>,
): BlobStorage => ({
  uploadPending: vi.fn(),
  generateUploadUrl: vi.fn().mockResolvedValue({
    uploadUrl: "https://minio.example.com/presigned-url",
    pendingPath: "pending/issue-id/photo-id.jpg",
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
  const issueId = parseId<IssueId>("019560a0-0000-7000-8000-000000000001");

  it("photoId を生成し Presigned URL を返す", async () => {
    const blobStorage = createMockBlobStorage();
    const useCase = generatePhotoUploadUrlUseCase(blobStorage);

    const result = await useCase({
      issueId,
      fileName: "crack.jpg",
      phase: "before",
    });

    expect(result.photoId).toBeDefined();
    expect(typeof result.photoId).toBe("string");
    expect(result.uploadUrl).toBe("https://minio.example.com/presigned-url");

    expect(blobStorage.generateUploadUrl).toHaveBeenCalledWith(
      issueId,
      result.photoId,
      "crack.jpg",
      "before",
    );
  });

  it("phase: after でも正しく動作する", async () => {
    const blobStorage = createMockBlobStorage();
    const useCase = generatePhotoUploadUrlUseCase(blobStorage);

    const result = await useCase({
      issueId,
      fileName: "fixed.png",
      phase: "after",
    });

    expect(result.photoId).toBeDefined();
    expect(blobStorage.generateUploadUrl).toHaveBeenCalledWith(
      issueId,
      result.photoId,
      "fixed.png",
      "after",
    );
  });

  it("BlobStorage のエラーがそのまま伝播する", async () => {
    const blobStorage = createMockBlobStorage({
      generateUploadUrl: vi
        .fn()
        .mockRejectedValue(new Error("Storage unavailable")),
    });
    const useCase = generatePhotoUploadUrlUseCase(blobStorage);

    await expect(
      useCase({ issueId, fileName: "test.jpg", phase: "before" }),
    ).rejects.toThrow("Storage unavailable");
  });
});
