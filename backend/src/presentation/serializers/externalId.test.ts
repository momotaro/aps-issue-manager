import { uuidv7 } from "uuidv7";
import { describe, expect, it } from "vitest";
import { base62ToUuid, uuidToBase62 } from "./externalId.js";

describe("externalId", () => {
  it("uuidToBase62 は 22 文字の base62 文字列を返す", () => {
    const uuid = uuidv7();
    const encoded = uuidToBase62(uuid);
    expect(encoded).toMatch(/^[0-9A-Za-z]+$/);
    expect(encoded).toHaveLength(22);
  });

  it("base62ToUuid でラウンドトリップできる", () => {
    const uuid = uuidv7();
    const encoded = uuidToBase62(uuid);
    expect(base62ToUuid(encoded)).toBe(uuid);
  });
});
