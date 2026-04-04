import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApsClient = {
  getAccessToken: vi.fn(),
};

vi.mock("../../compositionRoot.js", () => ({
  apsClient: mockApsClient,
}));

const { apsRoutes } = await import("./apsRoutes.js");

const app = new Hono().route("/api/aps", apsRoutes);

describe("apsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/aps/token", () => {
    it("200 でアクセストークンを返す", async () => {
      mockApsClient.getAccessToken.mockResolvedValue("test-access-token");

      const res = await app.request("/api/aps/token");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ access_token: "test-access-token" });
    });

    it("500 でトークン取得失敗時にエラーを返す", async () => {
      mockApsClient.getAccessToken.mockRejectedValue(
        new Error("APS auth failed: 401"),
      );

      const res = await app.request("/api/aps/token");

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "Failed to get APS token" });
    });

    it("503 で APS 未設定時にエラーを返す", async () => {
      mockApsClient.getAccessToken.mockRejectedValue(
        new Error("APS is not configured"),
      );

      const res = await app.request("/api/aps/token");

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body).toEqual({ error: "APS is not configured" });
    });
  });
});
