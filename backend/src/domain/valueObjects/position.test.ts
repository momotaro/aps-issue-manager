import { describe, expect, it } from "vitest";
import { createComponentPosition, createSpatialPosition } from "./position.js";

describe("Position", () => {
  describe("createSpatialPosition", () => {
    it("spatial 型の位置を生成する", () => {
      const pos = createSpatialPosition(1, 2, 3);
      expect(pos.type).toBe("spatial");
      expect(pos.worldPosition).toEqual({ x: 1, y: 2, z: 3 });
    });

    it("凍結されたオブジェクトを返す", () => {
      const pos = createSpatialPosition(0, 0, 0);
      expect(Object.isFrozen(pos)).toBe(true);
      expect(Object.isFrozen(pos.worldPosition)).toBe(true);
    });
  });

  describe("createComponentPosition", () => {
    it("component 型の位置を生成する", () => {
      const pos = createComponentPosition(42, 10, 20, 30);
      expect(pos.type).toBe("component");
      expect(pos.dbId).toBe(42);
      expect(pos.worldPosition).toEqual({ x: 10, y: 20, z: 30 });
    });

    it("凍結されたオブジェクトを返す", () => {
      const pos = createComponentPosition(1, 0, 0, 0);
      expect(Object.isFrozen(pos)).toBe(true);
      expect(Object.isFrozen(pos.worldPosition)).toBe(true);
    });
  });
});
