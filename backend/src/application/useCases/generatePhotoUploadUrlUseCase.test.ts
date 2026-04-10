import { describe, expect, it, vi } from "vitest";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import {
  type CommentId,
  generateId,
  type IssueId,
  parseId,
} from "../../domain/valueObjects/brandedId.js";
import { generatePhotoUploadUrlUseCase } from "./generatePhotoUploadUrlUseCase.js";

// ---------------------------------------------------------------------------
// テスト用データ
// ---------------------------------------------------------------------------

const issueId = parseId<IssueId>("019560a0-0000-7000-8000-000000000001");
const commentId = generateId<CommentId>();

// ---------------------------------------------------------------------------
// モック
// ---------------------------------------------------------------------------

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
    const blobStorage = createMockBlobStorage();
    const useCase = generatePhotoUploadUrlUseCase(blobStorage);

    const result = await useCase({
      issueId,
      commentId,
      fileName: "crack.jpg",
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
      commentId,
      result.value.photoId,
      "crack.jpg",
    );
  });
});
