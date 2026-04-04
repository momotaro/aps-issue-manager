import { describe, expect, it, vi } from "vitest";
import type { ApsClient } from "../../infrastructure/external/apsClient.js";
import { getApsTokenUseCase } from "./getApsTokenUseCase.js";

describe("getApsTokenUseCase", () => {
  it("APS クライアントからトークンを取得する", async () => {
    const mockClient: ApsClient = {
      getAccessToken: vi.fn().mockResolvedValue("test-token"),
    };
    const getToken = getApsTokenUseCase(mockClient);

    const token = await getToken();

    expect(token).toBe("test-token");
    expect(mockClient.getAccessToken).toHaveBeenCalledOnce();
  });

  it("APS 未設定時にエラーを投げる", async () => {
    const getToken = getApsTokenUseCase(null);

    await expect(getToken()).rejects.toThrow("APS is not configured");
  });
});
