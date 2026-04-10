import { describe, expect, it } from "vitest";
import { generateId, type PhotoId } from "./brandedId.js";
import { confirmedBlobPath, createPhoto, pendingBlobPath } from "./photo.js";

describe("Photo", () => {
  describe("createPhoto", () => {
    it("凍結された Photo オブジェクトを返す", () => {
      const photo = createPhoto({
        id: generateId<PhotoId>(),
        fileName: "crack.jpg",
        storagePath: "confirmed/issue1/comment1/photo1.jpg",
        uploadedAt: new Date(),
      });
      expect(Object.isFrozen(photo)).toBe(true);
      expect(photo.fileName).toBe("crack.jpg");
    });
  });

  describe("pendingBlobPath", () => {
    it("pending プレフィックスのパスを生成する（commentId 含む）", () => {
      const path = pendingBlobPath("issue123", "comment789", "photo456", "jpg");
      expect(path).toBe("pending/issue123/comment789/photo456.jpg");
    });
  });

  describe("confirmedBlobPath", () => {
    it("confirmed プレフィックスのパスを生成する（commentId 含む）", () => {
      const path = confirmedBlobPath(
        "issue123",
        "comment789",
        "photo456",
        "jpg",
      );
      expect(path).toBe("confirmed/issue123/comment789/photo456.jpg");
    });

    it("異なる拡張子でも正しくパスを生成する", () => {
      const path = confirmedBlobPath(
        "issue123",
        "comment789",
        "photo456",
        "png",
      );
      expect(path).toBe("confirmed/issue123/comment789/photo456.png");
    });
  });
});
