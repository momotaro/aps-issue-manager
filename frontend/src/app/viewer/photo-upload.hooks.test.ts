import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadToPresignedUrl, validateFile } from "./photo-upload.hooks";

// ---------------------------------------------------------------------------
// XMLHttpRequest モック
// ---------------------------------------------------------------------------

type XhrHandler = ((e: ProgressEvent) => void) | (() => void) | null;

class MockXHR {
  status = 200;
  upload = { onprogress: null as XhrHandler };
  onload: XhrHandler = null;
  onerror: XhrHandler = null;
  onabort: XhrHandler = null;
  readyState = 0;

  open = vi.fn();
  send = vi.fn();
  setRequestHeader = vi.fn();
  abort = vi.fn(() => {
    if (this.onabort) (this.onabort as () => void)();
  });

  // テストから呼ぶヘルパー
  simulateLoad(status: number) {
    this.status = status;
    if (this.onload) (this.onload as () => void)();
  }

  simulateError() {
    if (this.onerror) (this.onerror as () => void)();
  }

  simulateProgress(loaded: number, total: number) {
    if (this.upload.onprogress) {
      (this.upload.onprogress as (e: ProgressEvent) => void)({
        lengthComputable: true,
        loaded,
        total,
      } as unknown as ProgressEvent);
    }
  }
}

let mockXhr: MockXHR;

// XMLHttpRequest をクラスとして stub する
vi.stubGlobal("XMLHttpRequest", function MockXHRConstructor() {
  mockXhr = new MockXHR();
  return mockXhr;
});

// ---------------------------------------------------------------------------
// validateFile
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

  it("MIMEタイプが空のファイルを拒否する", () => {
    const file = new File(["data"], "unknown", { type: "" });
    expect(validateFile(file)).toEqual({
      fileName: "unknown",
      reason: "type",
    });
  });
});

// ---------------------------------------------------------------------------
// uploadToPresignedUrl
// ---------------------------------------------------------------------------

describe("uploadToPresignedUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("アップロード成功（200）で resolve する", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    const onProgress = vi.fn();
    const controller = new AbortController();

    const promise = uploadToPresignedUrl(
      "http://localhost:9000/upload",
      file,
      onProgress,
      controller.signal,
    );

    expect(mockXhr.open).toHaveBeenCalledWith(
      "PUT",
      "http://localhost:9000/upload",
    );
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith(
      "Content-Type",
      "image/jpeg",
    );
    expect(mockXhr.send).toHaveBeenCalledWith(file);

    mockXhr.simulateLoad(200);
    await expect(promise).resolves.toBeUndefined();
  });

  it("非 2xx レスポンスで reject する", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    const controller = new AbortController();

    const promise = uploadToPresignedUrl(
      "http://localhost:9000/upload",
      file,
      vi.fn(),
      controller.signal,
    );

    mockXhr.simulateLoad(403);
    await expect(promise).rejects.toThrow("Upload failed with status 403");
  });

  it("ネットワークエラーで reject する", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    const controller = new AbortController();

    const promise = uploadToPresignedUrl(
      "http://localhost:9000/upload",
      file,
      vi.fn(),
      controller.signal,
    );

    mockXhr.simulateError();
    await expect(promise).rejects.toThrow("Upload failed");
  });

  it("進捗コールバックが呼ばれる", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    const onProgress = vi.fn();
    const controller = new AbortController();

    const promise = uploadToPresignedUrl(
      "http://localhost:9000/upload",
      file,
      onProgress,
      controller.signal,
    );

    mockXhr.simulateProgress(500, 1000);
    expect(onProgress).toHaveBeenCalledWith(50);

    mockXhr.simulateProgress(1000, 1000);
    expect(onProgress).toHaveBeenCalledWith(100);

    mockXhr.simulateLoad(200);
    await promise;
  });

  it("abort で AbortError を reject する", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    const controller = new AbortController();

    const promise = uploadToPresignedUrl(
      "http://localhost:9000/upload",
      file,
      vi.fn(),
      controller.signal,
    );

    controller.abort();
    await expect(promise).rejects.toThrow("Upload aborted");

    try {
      await promise;
    } catch (e) {
      expect(e).toBeInstanceOf(DOMException);
      expect((e as DOMException).name).toBe("AbortError");
    }
  });

  it("abort 後に onload が発火しても二重 settle しない", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    const controller = new AbortController();

    const promise = uploadToPresignedUrl(
      "http://localhost:9000/upload",
      file,
      vi.fn(),
      controller.signal,
    );

    controller.abort();
    // abort 後に onload が発火（XHR の実装によっては起こり得る）
    mockXhr.simulateLoad(200);

    await expect(promise).rejects.toThrow("Upload aborted");
  });

  it("成功後に abort しても二重 settle しない", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    const controller = new AbortController();

    const promise = uploadToPresignedUrl(
      "http://localhost:9000/upload",
      file,
      vi.fn(),
      controller.signal,
    );

    mockXhr.simulateLoad(200);
    await promise;

    // 成功後に abort（no-op のはず）
    controller.abort();
  });
});
