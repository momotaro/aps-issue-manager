import { describe, expect, it, vi } from "vitest";
import type {
  IssueDetail,
  IssueQueryService,
} from "../../domain/repositories/issueQueryService.js";
import {
  type IssueId,
  type ProjectId,
  parseId,
} from "../../domain/valueObjects/brandedId.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { getIssueDetailUseCase } from "./getIssueDetailUseCase.js";

// ---------------------------------------------------------------------------
// テスト用ヘルパー
// ---------------------------------------------------------------------------

const issueId = parseId<IssueId>("01ISSUE000000000000000ISSUE");
const projectId = parseId<ProjectId>("01PROJ0000000000000000PROJ0");

const createMockDetail = (overrides?: Partial<IssueDetail>): IssueDetail => ({
  id: issueId,
  projectId,
  title: "壁のひび割れ",
  status: "open",
  category: "quality_defect",
  reporterName: "山田太郎",
  assigneeName: null,
  position: createSpatialPosition(10, 20, 30),
  photoCount: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  description: "3階東側の壁にひび割れを確認",
  photos: [],
  recentComments: [],
  ...overrides,
});

const createMockQueryService = (
  overrides?: Partial<IssueQueryService>,
): IssueQueryService => ({
  findAll: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(null),
  getEventHistory: vi.fn().mockResolvedValue([]),
  ...overrides,
});

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("getIssueDetailUseCase", () => {
  it("存在する指摘の詳細を取得できる", async () => {
    const detail = createMockDetail();
    const queryService = createMockQueryService({
      findById: vi.fn().mockResolvedValue(detail),
    });

    const result = await getIssueDetailUseCase(queryService)(issueId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(detail);
    }
    expect(queryService.findById).toHaveBeenCalledWith(issueId);
  });

  it("存在しない指摘の場合はエラーを返す", async () => {
    const queryService = createMockQueryService({
      findById: vi.fn().mockResolvedValue(null),
    });
    const nonExistentId = parseId<IssueId>("01NONEXISTENT00000000NOONE");

    const result = await getIssueDetailUseCase(queryService)(nonExistentId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ISSUE_NOT_FOUND");
      expect(result.error.message).toContain(nonExistentId);
    }
    expect(queryService.findById).toHaveBeenCalledWith(nonExistentId);
  });
});
