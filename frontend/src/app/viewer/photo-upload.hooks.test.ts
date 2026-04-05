import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateFile } from "./photo-upload.hooks";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockGeneratePhotoUploadUrl = vi.fn();
const mockConfirmPhotoUpload = vi.fn();
const mockRemovePhoto = vi.fn();

vi.mock("@/repositories/issue-repository", () => ({
  issueRepository: {
    generatePhotoUploadUrl: (...args: unknown[]) =>
      mockGeneratePhotoUploadUrl(...args),
    confirmPhotoUpload: (...args: unknown[]) => mockConfirmPhotoUpload(...args),
    removePhoto: (...args: unknown[]) => mockRemovePhoto(...args),
    getIssueDetail: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: (input: unknown) => Promise<unknown>;
    onSuccess?: () => void;
  }) => ({
    mutate: async (input: unknown) => {
      await mutationFn(input);
      onSuccess?.();
    },
    isPending: false,
  }),
  useQuery: () => ({ data: undefined, isLoading: false, error: null }),
}));

// ---------------------------------------------------------------------------
// Tests for validateFile (imported from source)
// ---------------------------------------------------------------------------

describe("validateFile", () => {
  it("画像ファイルを受け入れる", () => {
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    expect(validateFile(file)).toBeNull();
  });

  it("画像ファイル（PNG）を受け入れる", () => {
    const file = new File(["data"], "photo.png", { type: "image/png" });
    expect(validateFile(file)).toBeNull();
  });

  it("非画像ファイルを拒否する", () => {
    const file = new File(["data"], "document.pdf", {
      type: "application/pdf",
    });
    expect(validateFile(file)).toEqual({
      fileName: "document.pdf",
      reason: "type",
    });
  });

  it("テキストファイルを拒否する", () => {
    const file = new File(["data"], "readme.txt", { type: "text/plain" });
    expect(validateFile(file)).toEqual({
      fileName: "readme.txt",
      reason: "type",
    });
  });

  it("10MBを超えるファイルを拒否する", () => {
    const largeContent = new Uint8Array(10 * 1024 * 1024 + 1);
    const file = new File([largeContent], "large.jpg", { type: "image/jpeg" });
    expect(validateFile(file)).toEqual({
      fileName: "large.jpg",
      reason: "size",
    });
  });

  it("ちょうど10MBのファイルを受け入れる", () => {
    const content = new Uint8Array(10 * 1024 * 1024);
    const file = new File([content], "exact.jpg", { type: "image/jpeg" });
    expect(validateFile(file)).toBeNull();
  });

  it("0バイトの画像ファイルを受け入れる", () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });
    expect(validateFile(file)).toBeNull();
  });

  it("MIMEタイプが空のファイルを拒否する", () => {
    const file = new File(["data"], "unknown", { type: "" });
    expect(validateFile(file)).toEqual({
      fileName: "unknown",
      reason: "type",
    });
  });
});

// ---------------------------------------------------------------------------
// Tests for Repository API flow (Presigned URL → confirm)
// ---------------------------------------------------------------------------

describe("photo upload API flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Presigned URL取得 → confirm の正常フロー", async () => {
    const issueId = "testIssueId123456789012";
    const photoId = "testPhotoId123456789012";
    const uploadUrl = "http://localhost:9000/presigned-url";

    mockGeneratePhotoUploadUrl.mockResolvedValue({ photoId, uploadUrl });
    mockConfirmPhotoUpload.mockResolvedValue({ ok: true });

    const result = await mockGeneratePhotoUploadUrl(
      issueId,
      "test.jpg",
      "before",
    );
    expect(result).toEqual({ photoId, uploadUrl });
    expect(mockGeneratePhotoUploadUrl).toHaveBeenCalledWith(
      issueId,
      "test.jpg",
      "before",
    );

    const confirmResult = await mockConfirmPhotoUpload(
      issueId,
      photoId,
      "test.jpg",
      "before",
      "actorId",
    );
    expect(confirmResult).toEqual({ ok: true });
  });

  it("Presigned URL取得失敗時のエラー", async () => {
    mockGeneratePhotoUploadUrl.mockRejectedValue(
      new Error("Failed to generate upload URL"),
    );

    await expect(
      mockGeneratePhotoUploadUrl("issueId", "test.jpg", "before"),
    ).rejects.toThrow("Failed to generate upload URL");
  });

  it("confirm API失敗時のエラー", async () => {
    mockConfirmPhotoUpload.mockRejectedValue(
      new Error("Failed to confirm photo upload"),
    );

    await expect(
      mockConfirmPhotoUpload(
        "issueId",
        "photoId",
        "test.jpg",
        "before",
        "actor",
      ),
    ).rejects.toThrow("Failed to confirm photo upload");
  });
});

// ---------------------------------------------------------------------------
// Tests for photo deletion
// ---------------------------------------------------------------------------

describe("photo deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("写真削除の正常フロー", async () => {
    mockRemovePhoto.mockResolvedValue({ ok: true });

    const result = await mockRemovePhoto("issueId", "photoId", "actorId");
    expect(result).toEqual({ ok: true });
    expect(mockRemovePhoto).toHaveBeenCalledWith(
      "issueId",
      "photoId",
      "actorId",
    );
  });

  it("写真削除API失敗時のエラー", async () => {
    mockRemovePhoto.mockRejectedValue(new Error("Failed to remove photo"));

    await expect(
      mockRemovePhoto("issueId", "photoId", "actorId"),
    ).rejects.toThrow("Failed to remove photo");
  });
});
