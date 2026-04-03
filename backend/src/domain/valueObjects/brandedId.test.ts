import { describe, expect, it } from "vitest";
import {
  type EventId,
  generateId,
  type IssueId,
  type PhotoId,
  type ProjectId,
  parseId,
  type UserId,
} from "./brandedId.js";

const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("BrandedId", () => {
  describe("generateId", () => {
    it.each([
      ["IssueId", () => generateId<IssueId>()],
      ["UserId", () => generateId<UserId>()],
      ["ProjectId", () => generateId<ProjectId>()],
      ["EventId", () => generateId<EventId>()],
      ["PhotoId", () => generateId<PhotoId>()],
    ])("%s は UUID v7 を返す", (_, gen) => {
      expect(gen()).toMatch(UUID_V7_REGEX);
    });

    it("毎回異なる ID を生成する", () => {
      const ids = new Set(
        Array.from({ length: 100 }, () => generateId<IssueId>()),
      );
      expect(ids.size).toBe(100);
    });
  });

  describe("parseId", () => {
    it.each([
      ["IssueId", "019650e6-4c00-7000-8000-000000000001"],
      ["UserId", "019650e6-4c00-7000-8000-000000000002"],
      ["ProjectId", "019650e6-4c00-7000-8000-000000000003"],
      ["EventId", "019650e6-4c00-7000-8000-000000000004"],
      ["PhotoId", "019650e6-4c00-7000-8000-000000000005"],
    ])("%s は文字列をそのまま Branded 型として返す", (_, raw) => {
      expect(parseId<IssueId>(raw)).toBe(raw);
    });
  });
});
