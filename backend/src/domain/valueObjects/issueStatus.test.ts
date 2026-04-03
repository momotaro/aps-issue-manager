import { describe, expect, it } from "vitest";
import {
  canTransition,
  isIssueStatus,
  validateTransition,
} from "./issueStatus.js";

describe("IssueStatus", () => {
  describe("canTransition", () => {
    it("open → in_progress を許可する", () => {
      expect(canTransition("open", "in_progress")).toBe(true);
    });

    it("in_progress → in_review を許可する", () => {
      expect(canTransition("in_progress", "in_review")).toBe(true);
    });

    it("in_review → done を許可する", () => {
      expect(canTransition("in_review", "done")).toBe(true);
    });

    it("in_review → in_progress（差し戻し）を許可する", () => {
      expect(canTransition("in_review", "in_progress")).toBe(true);
    });

    it("open → done を拒否する", () => {
      expect(canTransition("open", "done")).toBe(false);
    });

    it("done → open を拒否する", () => {
      expect(canTransition("done", "open")).toBe(false);
    });

    it("done からの遷移をすべて拒否する", () => {
      expect(canTransition("done", "in_progress")).toBe(false);
      expect(canTransition("done", "in_review")).toBe(false);
      expect(canTransition("done", "done")).toBe(false);
    });

    it("open → in_review を拒否する（スキップ不可）", () => {
      expect(canTransition("open", "in_review")).toBe(false);
    });
  });

  describe("validateTransition", () => {
    it("有効な遷移で ok: true を返す", () => {
      const result = validateTransition("open", "in_progress");
      expect(result).toEqual({ ok: true, value: "in_progress" });
    });

    it("無効な遷移で ok: false とエラー詳細を返す", () => {
      const result = validateTransition("open", "done");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_TRANSITION");
      }
    });
  });

  describe("isIssueStatus", () => {
    it("有効なステータス文字列に true を返す", () => {
      expect(isIssueStatus("open")).toBe(true);
      expect(isIssueStatus("in_progress")).toBe(true);
      expect(isIssueStatus("in_review")).toBe(true);
      expect(isIssueStatus("done")).toBe(true);
    });

    it("無効な値に false を返す", () => {
      expect(isIssueStatus("closed")).toBe(false);
      expect(isIssueStatus(42)).toBe(false);
      expect(isIssueStatus(null)).toBe(false);
    });
  });
});
