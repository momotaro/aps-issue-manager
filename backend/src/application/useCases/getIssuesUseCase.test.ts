import { describe, expect, it, vi } from "vitest";
import type {
  IssueFilters,
  IssueListItem,
  IssueQueryService,
} from "../../domain/repositories/issueQueryService.js";
import {
  type IssueId,
  type ProjectId,
  parseId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { getIssuesUseCase } from "./getIssuesUseCase.js";

// ---------------------------------------------------------------------------
// テスト用ヘルパー
// ---------------------------------------------------------------------------

const projectId = parseId<ProjectId>("01PROJ0000000000000000PROJ0");

const createMockItem = (overrides?: Partial<IssueListItem>): IssueListItem => ({
  id: parseId<IssueId>("01ISSUE000000000000000ISSUE"),
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

describe("getIssuesUseCase", () => {
  it("フィルタなしで一覧を取得できる", async () => {
    const items = [createMockItem()];
    const queryService = createMockQueryService({
      findAll: vi.fn().mockResolvedValue(items),
    });

    const result = await getIssuesUseCase(queryService)();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(items);
    expect(queryService.findAll).toHaveBeenCalledWith(undefined);
  });

  it("フィルタ付きで一覧を取得できる", async () => {
    const items = [createMockItem({ status: "in_progress" })];
    const filters: IssueFilters = {
      projectId,
      status: "in_progress",
    };
    const queryService = createMockQueryService({
      findAll: vi.fn().mockResolvedValue(items),
    });

    const result = await getIssuesUseCase(queryService)(filters);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(items);
    expect(queryService.findAll).toHaveBeenCalledWith(filters);
  });

  it("該当なしの場合は空配列を返す", async () => {
    const queryService = createMockQueryService({
      findAll: vi.fn().mockResolvedValue([]),
    });

    const result = await getIssuesUseCase(queryService)({
      assigneeId: parseId<UserId>("01NONEXISTENT00000000NOONE"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });
});
