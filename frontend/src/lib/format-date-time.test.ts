// TZ=UTC で実行（vitest.config.ts の env.TZ で保証）
import { describe, expect, it } from "vitest";
import { formatDateTime } from "./format-date-time";

describe("formatDateTime", () => {
  it("ISO 8601 文字列を M/D HH:mm 形式にフォーマットする（UTC）", () => {
    expect(formatDateTime("2026-04-10T14:32:00.000Z")).toBe("4/10 14:32");
  });

  it("月・日が1桁の場合にゼロ埋めしない（M/D 形式）", () => {
    expect(formatDateTime("2026-01-05T09:03:00.000Z")).toBe("1/5 09:03");
  });

  it("時・分を2桁にゼロ埋めする", () => {
    expect(formatDateTime("2026-04-10T00:03:00.000Z")).toBe("4/10 00:03");
  });

  it("境界値: 年末の日付", () => {
    expect(formatDateTime("2026-12-31T23:59:00.000Z")).toBe("12/31 23:59");
  });

  it("異常系: 不正な日付文字列は NaN/NaN NaN:NaN を返す（例外はスローしない）", () => {
    expect(() => formatDateTime("not-a-date")).not.toThrow();
    expect(formatDateTime("not-a-date")).toBe("NaN/NaN NaN:NaN");
  });
});
