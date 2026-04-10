import { describe, expect, it, vi } from "vitest";
import {
  applyEvent,
  changeStatus,
  createIssue,
} from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import {
  type CommentId,
  generateId,
  type IssueId,
  type ProjectId,
  parseId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { reviewIssueUseCase } from "./reviewIssueUseCase.js";

const actorId = parseId<UserId>("01ACTOR000000000000000ACTOR");
const projectId = parseId<ProjectId>("01PROJ0000000000000000PROJ0");

const makeIssueWithStatus = (
  status: "open" | "in_progress" | "in_review" = "open",
) => {
  const issueId = generateId<IssueId>();
  const result = createIssue({
    issueId,
    projectId,
    title: "テスト指摘",
    category: "quality_defect",
    position: createSpatialPosition(1, 2, 3),
    reporterId: actorId,
    assigneeId: null,
    actorId,
    comment: {
      commentId: generateId<CommentId>(),
      body: "初回コメント",
    },
  });
  if (!result.ok) throw new Error("createIssue failed");
  let issue = applyEvent(applyEvent(null, result.value[0]), result.value[1]);

  if (status === "in_progress" || status === "in_review") {
    const r1 = changeStatus(issue, "in_progress", actorId);
    if (r1.ok) issue = applyEvent(issue, r1.value);
  }
  if (status === "in_review") {
    const r2 = changeStatus(issue, "in_review", actorId);
    if (r2.ok) issue = applyEvent(issue, r2.value);
  }

  return issue;
};

const mockRepo = (
  issue: ReturnType<typeof makeIssueWithStatus> | null = null,
): IssueRepository => ({
  load: vi.fn().mockResolvedValue(issue),
  save: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  delete: vi.fn(),
});

describe("reviewIssueUseCase", () => {
  it("in_review → done + コメント追加で承認できる", async () => {
    const issue = makeIssueWithStatus("in_review");
    const repo = mockRepo(issue);
    const useCase = reviewIssueUseCase(repo);

    const result = await useCase({
      issueId: issue.id,
      status: "done",
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "是正を確認しました",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events).toHaveLength(2);
    expect(result.value.events[0].type).toBe("IssueStatusChanged");
    expect(result.value.events[1].type).toBe("CommentAdded");
  });

  it("in_review → in_progress（差し戻し）+ コメント追加できる", async () => {
    const issue = makeIssueWithStatus("in_review");
    const repo = mockRepo(issue);
    const useCase = reviewIssueUseCase(repo);

    const result = await useCase({
      issueId: issue.id,
      status: "in_progress",
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "是正が不十分です。再対応をお願いします",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events).toHaveLength(2);
    expect(result.value.events[0].type).toBe("IssueStatusChanged");
  });

  it("ステータスなし + コメントのみ追加できる", async () => {
    const issue = makeIssueWithStatus("in_review");
    const repo = mockRepo(issue);
    const useCase = reviewIssueUseCase(repo);

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "確認中です",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events).toHaveLength(1);
    expect(result.value.events[0].type).toBe("CommentAdded");
  });

  it("無効なステータス遷移はエラーを返す", async () => {
    const issue = makeIssueWithStatus("open");
    const repo = mockRepo(issue);
    const useCase = reviewIssueUseCase(repo);

    const result = await useCase({
      issueId: issue.id,
      status: "done", // open → done は無効
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "テスト",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });

  it("コメント本文が空の場合 EMPTY_COMMENT を返す", async () => {
    const issue = makeIssueWithStatus("in_review");
    const repo = mockRepo(issue);
    const useCase = reviewIssueUseCase(repo);

    const result = await useCase({
      issueId: issue.id,
      actorId,
      comment: {
        commentId: generateId<CommentId>(),
        body: "   ",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("EMPTY_COMMENT");
  });
});
