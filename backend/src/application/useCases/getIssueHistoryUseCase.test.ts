import { describe, expect, it, vi } from "vitest";
import type { IssueCreatedEvent } from "../../domain/events/issueEvents.js";
import type { IssueQueryService } from "../../domain/repositories/issueQueryService.js";
import {
  type EventId,
  type IssueId,
  type ProjectId,
  parseId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { getIssueHistoryUseCase } from "./getIssueHistoryUseCase.js";

// ---------------------------------------------------------------------------
// テスト用ヘルパー
// ---------------------------------------------------------------------------

const issueId = parseId<IssueId>("01ISSUE000000000000000ISSUE");
const actorId = parseId<UserId>("01ACTOR000000000000000ACTOR");
const projectId = parseId<ProjectId>("01PROJ0000000000000000PROJ0");

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

describe("getIssueHistoryUseCase", () => {
  it("指摘のイベント履歴を取得できる", async () => {
    const events: readonly IssueCreatedEvent[] = [
      {
        id: parseId<EventId>("01EVENT000000000000000EVENT"),
        issueId,
        occurredAt: new Date("2026-01-01"),
        actorId,
        version: 1,
        type: "IssueCreated",
        payload: {
          projectId,
          title: "壁のひび割れ",
          status: "open",
          category: "quality_defect",
          position: createSpatialPosition(10, 20, 30),
          reporterId: actorId,
          assigneeId: null,
        },
      },
    ];
    const queryService = createMockQueryService({
      getEventHistory: vi.fn().mockResolvedValue(events),
    });

    const result = await getIssueHistoryUseCase(queryService)(issueId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(events);
    expect(result.value).toHaveLength(1);
    expect(queryService.getEventHistory).toHaveBeenCalledWith(issueId);
  });

  it("イベントが存在しない場合は空配列を返す", async () => {
    const queryService = createMockQueryService({
      getEventHistory: vi.fn().mockResolvedValue([]),
    });

    const result = await getIssueHistoryUseCase(queryService)(issueId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });
});
