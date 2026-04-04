import { describe, expect, it } from "vitest";
import { mapResultErrorToStatus } from "./errorHandler.js";

describe("mapResultErrorToStatus", () => {
  it("*_NOT_FOUND コードは 404 を返す", () => {
    expect(mapResultErrorToStatus("ISSUE_NOT_FOUND")).toBe(404);
    expect(mapResultErrorToStatus("PHOTO_NOT_FOUND")).toBe(404);
  });

  it("競合系コードは 409 を返す", () => {
    expect(mapResultErrorToStatus("INVALID_TRANSITION")).toBe(409);
    expect(mapResultErrorToStatus("CONCURRENCY_CONFLICT")).toBe(409);
    expect(mapResultErrorToStatus("DUPLICATE_PHOTO")).toBe(409);
  });

  it("クライアントエラー系コードは 400 を返す", () => {
    expect(mapResultErrorToStatus("NO_CHANGES")).toBe(400);
    expect(mapResultErrorToStatus("NO_CHANGE")).toBe(400);
    expect(mapResultErrorToStatus("EMPTY_TITLE")).toBe(400);
    expect(mapResultErrorToStatus("INVALID_FILE_EXTENSION")).toBe(400);
  });

  it("未知のコードは 500 を返す", () => {
    expect(mapResultErrorToStatus("SAVE_FAILED")).toBe(500);
    expect(mapResultErrorToStatus("QUERY_FAILED")).toBe(500);
    expect(mapResultErrorToStatus("UNKNOWN_CODE")).toBe(500);
  });
});
