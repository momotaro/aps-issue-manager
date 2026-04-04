import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../domain/entities/user.js";
import type { UserId } from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import { uuidToBase62 } from "../serializers/externalId.js";

const mockRepo = {
  findById: vi.fn(),
  findAll: vi.fn(),
  save: vi.fn(),
  findByEmail: vi.fn(),
};

vi.mock("../../compositionRoot.js", () => ({
  userRepository: mockRepo,
}));

// import after mock setup
const { userRoutes } = await import("./userRoutes.js");

const app = new Hono().route("/api/users", userRoutes);

const testUser: User = {
  id: parseId<UserId>("019654a1-b234-7000-8000-000000000001"),
  name: "テストユーザー",
  email: "test@example.com",
  role: "member",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const testUserBase62Id = uuidToBase62(testUser.id);

describe("userRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/users", () => {
    it("201 で新規ユーザーを返す", async () => {
      mockRepo.save.mockResolvedValue(undefined);
      const res = await app.request("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "新規ユーザー",
          email: "new@example.com",
          role: "member",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("新規ユーザー");
      expect(body.email).toBe("new@example.com");
      expect(body.id).toBeDefined();
      expect(mockRepo.save).toHaveBeenCalledOnce();
    });

    it("バリデーションエラーで 400 を返す", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", email: "invalid", role: "member" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/users", () => {
    it("ユーザー一覧を返す", async () => {
      mockRepo.findAll.mockResolvedValue([testUser]);
      const res = await app.request("/api/users");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(testUserBase62Id);
    });
  });

  describe("GET /api/users/:id", () => {
    it("存在するユーザーを返す", async () => {
      mockRepo.findById.mockResolvedValue(testUser);
      const res = await app.request(`/api/users/${testUserBase62Id}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("テストユーザー");
    });

    it("存在しないユーザーで 404 を返す", async () => {
      mockRepo.findById.mockResolvedValue(null);
      const res = await app.request(`/api/users/${testUserBase62Id}`);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PUT /api/users/:id", () => {
    it("ユーザーを更新して返す", async () => {
      mockRepo.findById.mockResolvedValue(testUser);
      mockRepo.save.mockResolvedValue(undefined);
      const res = await app.request(`/api/users/${testUserBase62Id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "更新後" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("更新後");
    });

    it("存在しないユーザーで 404 を返す", async () => {
      mockRepo.findById.mockResolvedValue(null);
      const res = await app.request(`/api/users/${testUserBase62Id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });
      expect(res.status).toBe(404);
    });
  });
});
