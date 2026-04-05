import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IssueId,
  ProjectId,
  UserId,
} from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import { uuidToBase62 } from "../serializers/externalId.js";

const issueId = parseId<IssueId>("019654a1-b234-7000-8000-000000000010");
const projectId = parseId<ProjectId>("019654a1-b234-7000-8000-000000000020");
const userId = parseId<UserId>("019654a1-b234-7000-8000-000000000030");

const issueBase62 = uuidToBase62(issueId);
const projectBase62 = uuidToBase62(projectId);
const userBase62 = uuidToBase62(userId);

const mockIssueRepo = {
  load: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  saveSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
};

const mockQueryService = {
  findById: vi.fn(),
  findAll: vi.fn(),
  getEventHistory: vi.fn(),
};

const mockBlobStorage = {
  generateUploadUrl: vi.fn(),
  confirmPending: vi.fn(),
  deletePhoto: vi.fn(),
  deleteByIssue: vi.fn(),
};

vi.mock("../../compositionRoot.js", () => ({
  issueRepository: mockIssueRepo,
  issueQueryService: mockQueryService,
  blobStorage: mockBlobStorage,
}));

const { issueRoutes } = await import("./issueRoutes.js");

const app = new Hono().route("/api/issues", issueRoutes);

const listItem = {
  id: issueId,
  projectId,
  title: "テスト指摘",
  status: "open" as const,
  category: "quality_defect" as const,
  reporterName: "テスト太郎",
  assigneeName: null,
  position: { type: "spatial" as const, worldPosition: { x: 1, y: 2, z: 3 } },
  photoCount: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const detail = {
  ...listItem,
  description: "詳細",
  photos: [],
};

describe("issueRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/issues", () => {
    it("一覧を返す", async () => {
      mockQueryService.findAll.mockResolvedValue([listItem]);
      const res = await app.request("/api/issues");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(issueBase62);
    });
  });

  describe("GET /api/issues/:id", () => {
    it("詳細を返す", async () => {
      mockQueryService.findById.mockResolvedValue(detail);
      const res = await app.request(`/api/issues/${issueBase62}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe("テスト指摘");
      expect(body.description).toBe("詳細");
    });

    it("存在しない場合 404 を返す", async () => {
      mockQueryService.findById.mockResolvedValue(null);
      const res = await app.request(`/api/issues/${issueBase62}`);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("ISSUE_NOT_FOUND");
    });
  });

  describe("POST /api/issues", () => {
    it("201 で issueId を返す", async () => {
      mockIssueRepo.save.mockResolvedValue(undefined);
      const res = await app.request("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectBase62,
          title: "新規指摘",
          description: "テスト",
          category: "quality_defect",
          position: { type: "spatial", worldPosition: { x: 0, y: 0, z: 0 } },
          reporterId: userBase62,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.issueId).toBeDefined();
    });

    it("バリデーションエラーで 400 を返す", async () => {
      const res = await app.request("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/issues/:id", () => {
    it("存在しない場合 404 を返す", async () => {
      mockIssueRepo.load.mockResolvedValue(null);
      const res = await app.request(`/api/issues/${issueBase62}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("ISSUE_NOT_FOUND");
    });
  });

  describe("GET /api/issues/:id/history", () => {
    it("イベント履歴を返す", async () => {
      mockQueryService.getEventHistory.mockResolvedValue([
        {
          id: parseId("019654a1-b234-7000-8000-000000000099"),
          issueId,
          type: "IssueCreated",
          payload: {
            projectId,
            title: "テスト",
            description: "",
            status: "open",
            category: "quality_defect",
            position: { type: "spatial", worldPosition: { x: 0, y: 0, z: 0 } },
            reporterId: userId,
            assigneeId: null,
            photos: [],
          },
          actorId: userId,
          version: 1,
          occurredAt: new Date("2026-01-01T00:00:00Z"),
        },
      ]);
      const res = await app.request(`/api/issues/${issueBase62}/history`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].type).toBe("IssueCreated");
      // payload 内の ID が base62 に変換されていること
      expect(body[0].payload.projectId).toBe(projectBase62);
      expect(body[0].payload.reporterId).toBe(userBase62);
    });
  });
});
