import { describe, expect, it } from "vitest";
import { getPhotoUrl } from "./photo-url";

describe("getPhotoUrl", () => {
  it("storagePath から MinIO URL を構築する", () => {
    const url = getPhotoUrl("confirmed/uuid1/before/uuid2.jpg");
    expect(url).toBe(
      "http://localhost:9000/issues/confirmed/uuid1/before/uuid2.jpg",
    );
  });

  it("after フェーズのパスも正しく構築する", () => {
    const url = getPhotoUrl("confirmed/uuid1/after/uuid2.png");
    expect(url).toBe(
      "http://localhost:9000/issues/confirmed/uuid1/after/uuid2.png",
    );
  });

  it("先頭スラッシュ付きの storagePath を正しく処理する", () => {
    const url = getPhotoUrl("/confirmed/uuid1/before/uuid2.jpg");
    expect(url).toBe(
      "http://localhost:9000/issues/confirmed/uuid1/before/uuid2.jpg",
    );
  });

  it("特殊文字を含むパスをエンコードする", () => {
    const url = getPhotoUrl("confirmed/uuid1/before/file name.jpg");
    expect(url).toContain("file%20name.jpg");
  });
});
