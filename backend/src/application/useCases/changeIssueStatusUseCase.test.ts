import { describe, expect, it, vi } from "vitest";
import { applyEvent, createIssue } from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import {
  type IssueId,
  type ProjectId,
  parseId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { changeIssueStatusUseCase } from "./changeIssueStatusUseCase.js";

// ---------------------------------------------------------------------------
// テスト用ヘルパー
// ---------------------------------------------------------------------------

const actorId = parseId<UserId>("01ACTOR000000000000000ACTOR");
const projectId = parseId<ProjectId>("01PROJ0000000000000000PROJ0");
const reporterId = parseId<UserId>("01REPORTER00000000000REPORT");

/** テスト用の Issue 状態を生成する（status: open, version: 1） */
const makeIssue = () => {
  const result = createIssue({
    projectId,
    title: "壁のひび割れ",
    description: "3階東側の壁にひび割れを確認",
    category: "quality_defect" as const,
    position: createSpatialPosition(10, 20, 30),
    reporterId,
    assigneeId: null,
    photos: [] as const,
    actorId,
  });
  if (!result.ok) throw new Error("createIssue failed");
  return applyEvent(null, result.value);
};

/** IssueRepository のモック生成 */
const createMockRepo = (
  overrides: Partial<IssueRepository> = {},
): IssueRepository => ({
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
  getSnapshot: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("changeIssueStatusUseCase", () => {
  it("正常系: open → in_progress のステータス遷移が成功する", async () => {
    const issue = makeIssue();
    const repo = createMockRepo({ load: vi.fn().mockResolvedValue(issue) });
    const useCase = changeIssueStatusUseCase(repo);

    const result = await useCase({
      issueId: issue.id,
      newStatus: "in_progress",
      actorId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.event.type).toBe("IssueStatusChanged");
    expect(result.value.event.payload.from).toBe("open");
    expect(result.value.event.payload.to).toBe("in_progress");
    expect(result.value.event.version).toBe(2);

    expect(repo.save).toHaveBeenCalledWith(
      issue.id,
      [result.value.event],
      issue.version,
    );
  });

  it("正常系: in_review → in_progress の差し戻しが成功する", async () => {
    // open → in_progress → in_review の状態を作る
    const issue = makeIssue();
    const inProgress = applyEvent(issue, {
      ...issue,
      id: parseId("01EVT0000000000000000000001"),
      issueId: issue.id,
      occurredAt: new Date(),
      actorId,
      version: 2,
      type: "IssueStatusChanged" as const,
      payload: Object.freeze({
        from: "open" as const,
        to: "in_progress" as const,
      }),
    });
    const inReview = applyEvent(inProgress, {
      ...inProgress,
      id: parseId("01EVT0000000000000000000002"),
      issueId: issue.id,
      occurredAt: new Date(),
      actorId,
      version: 3,
      type: "IssueStatusChanged" as const,
      payload: Object.freeze({
        from: "in_progress" as const,
        to: "in_review" as const,
      }),
    });

    const repo = createMockRepo({ load: vi.fn().mockResolvedValue(inReview) });
    const useCase = changeIssueStatusUseCase(repo);

    const result = await useCase({
      issueId: issue.id,
      newStatus: "in_progress",
      actorId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.event.payload.from).toBe("in_review");
    expect(result.value.event.payload.to).toBe("in_progress");
  });

  it("異常系: 存在しない Issue でエラーを返す", async () => {
    const repo = createMockRepo();
    const useCase = changeIssueStatusUseCase(repo);
    const issueId = parseId<IssueId>("01ISSUE000000000000000ISSUE");

    const result = await useCase({
      issueId,
      newStatus: "in_progress",
      actorId,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("ISSUE_NOT_FOUND");
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("異常系: 無効なステータス遷移（open → done）でエラーを返す", async () => {
    const issue = makeIssue();
    const repo = createMockRepo({ load: vi.fn().mockResolvedValue(issue) });
    const useCase = changeIssueStatusUseCase(repo);

    const result = await useCase({
      issueId: issue.id,
      newStatus: "done",
      actorId,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("異常系: done からの遷移は不可", async () => {
    const issue = makeIssue();
    // done 状態を作る
    const done = applyEvent(
      applyEvent(
        applyEvent(issue, {
          id: parseId("01EVT0000000000000000000001"),
          issueId: issue.id,
          occurredAt: new Date(),
          actorId,
          version: 2,
          type: "IssueStatusChanged" as const,
          payload: Object.freeze({
            from: "open" as const,
            to: "in_progress" as const,
          }),
        }),
        {
          id: parseId("01EVT0000000000000000000002"),
          issueId: issue.id,
          occurredAt: new Date(),
          actorId,
          version: 3,
          type: "IssueStatusChanged" as const,
          payload: Object.freeze({
            from: "in_progress" as const,
            to: "in_review" as const,
          }),
        },
      ),
      {
        id: parseId("01EVT0000000000000000000003"),
        issueId: issue.id,
        occurredAt: new Date(),
        actorId,
        version: 4,
        type: "IssueStatusChanged" as const,
        payload: Object.freeze({
          from: "in_review" as const,
          to: "done" as const,
        }),
      },
    );

    const repo = createMockRepo({ load: vi.fn().mockResolvedValue(done) });
    const useCase = changeIssueStatusUseCase(repo);

    const result = await useCase({
      issueId: issue.id,
      newStatus: "open",
      actorId,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });
});
