import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../../domain/entities/project.js";
import type { ProjectId } from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import { uuidToBase62 } from "../serializers/externalId.js";

const mockRepo = {
  findById: vi.fn(),
  findAll: vi.fn(),
  save: vi.fn(),
};

vi.mock("../../compositionRoot.js", () => ({
  projectRepository: mockRepo,
}));

const { projectRoutes } = await import("./projectRoutes.js");

const app = new Hono().route("/api/projects", projectRoutes);

const testProject: Project = {
  id: parseId<ProjectId>("019654a1-b234-7000-8000-000000000002"),
  name: "テストプロジェクト",
  description: "テスト用",
  modelUrn: "urn:adsk.objects:test",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const testProjectBase62Id = uuidToBase62(testProject.id);

describe("projectRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/projects", () => {
    it("201 で新規プロジェクトを返す", async () => {
      mockRepo.save.mockResolvedValue(undefined);
      const res = await app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "新規プロジェクト",
          description: "説明",
          modelUrn: "urn:adsk.objects:new",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("新規プロジェクト");
      expect(body.id).toBeDefined();
    });

    it("バリデーションエラーで 400 を返す", async () => {
      const res = await app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", description: "d", modelUrn: "u" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/projects", () => {
    it("プロジェクト一覧を返す", async () => {
      mockRepo.findAll.mockResolvedValue([testProject]);
      const res = await app.request("/api/projects");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(testProjectBase62Id);
    });
  });

  describe("GET /api/projects/:id", () => {
    it("存在するプロジェクトを返す", async () => {
      mockRepo.findById.mockResolvedValue(testProject);
      const res = await app.request(`/api/projects/${testProjectBase62Id}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("テストプロジェクト");
    });

    it("存在しないプロジェクトで 404 を返す", async () => {
      mockRepo.findById.mockResolvedValue(null);
      const res = await app.request(`/api/projects/${testProjectBase62Id}`);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PUT /api/projects/:id", () => {
    it("プロジェクトを更新して返す", async () => {
      mockRepo.findById.mockResolvedValue(testProject);
      mockRepo.save.mockResolvedValue(undefined);
      const res = await app.request(`/api/projects/${testProjectBase62Id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "更新後" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("更新後");
    });

    it("存在しないプロジェクトで 404 を返す", async () => {
      mockRepo.findById.mockResolvedValue(null);
      const res = await app.request(`/api/projects/${testProjectBase62Id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });
      expect(res.status).toBe(404);
    });
  });
});
