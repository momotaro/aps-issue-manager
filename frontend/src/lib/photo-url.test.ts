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
});
