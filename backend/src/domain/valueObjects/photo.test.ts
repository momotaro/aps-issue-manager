import { describe, expect, it } from "vitest";
import { generateId, type PhotoId } from "./brandedId.js";
import { confirmedBlobPath, createPhoto, pendingBlobPath } from "./photo.js";

describe("Photo", () => {
  describe("createPhoto", () => {
    it("凍結された Photo オブジェクトを返す", () => {
      const photo = createPhoto({
        id: generateId<PhotoId>(),
        fileName: "crack.jpg",
        storagePath: "confirmed/issue1/before/photo1.jpg",
        phase: "before",
        uploadedAt: new Date(),
      });
      expect(Object.isFrozen(photo)).toBe(true);
      expect(photo.fileName).toBe("crack.jpg");
      expect(photo.phase).toBe("before");
    });
  });

  describe("pendingBlobPath", () => {
    it("pending プレフィックスのパスを生成する", () => {
      const path = pendingBlobPath("issue123", "photo456", "jpg");
      expect(path).toBe("pending/issue123/photo456.jpg");
    });
  });

  describe("confirmedBlobPath", () => {
    it("before フェーズの confirmed パスを生成する", () => {
      const path = confirmedBlobPath("issue123", "before", "photo456", "jpg");
      expect(path).toBe("confirmed/issue123/before/photo456.jpg");
    });

    it("after フェーズの confirmed パスを生成する", () => {
      const path = confirmedBlobPath("issue123", "after", "photo456", "png");
      expect(path).toBe("confirmed/issue123/after/photo456.png");
    });
  });
});
