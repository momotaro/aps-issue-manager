import { describe, expect, it, vi } from "vitest";
import type { Issue } from "../../domain/entities/issue.js";
import { applyEvent, createIssue } from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import {
  type CommentId,
  generateId,
  type IssueId,
  type ProjectId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import { updateIssueUseCase } from "./updateIssueUseCase.js";

// ---------------------------------------------------------------------------
// テストヘルパー
// ---------------------------------------------------------------------------

const actorId = "user-1" as UserId;

/** テスト用の Issue 集約を作成する */
const makeIssue = (): Issue => {
  const result = createIssue({
    issueId: generateId<IssueId>(),
    projectId: "project-1" as ProjectId,
    title: "外壁タイルの浮き",
    category: "quality_defect",
    position: createSpatialPosition(1.0, 2.0, 3.0),
    reporterId: actorId,
    assigneeId: null,
    actorId,
    comment: {
      commentId: generateId<CommentId>(),
      body: "北側外壁3階部分にタイルの浮きを確認",
    },
  });
  if (!result.ok) throw new Error("Failed to create test issue");
  // createIssue returns [IssueCreatedEvent, CommentAddedEvent] — apply both
  const [createdEvent, commentEvent] = result.value;
  const state = applyEvent(null, createdEvent);
  return applyEvent(state, commentEvent);
};

const mockIssueRepo = (
  issue: Issue | null = null,
  overrides?: Partial<IssueRepository>,
): IssueRepository => ({
  load: vi.fn().mockResolvedValue(issue),
  save: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
  getSnapshot: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("updateIssueUseCase", () => {
  describe("正常系", () => {
    it("タイトルを更新し、IssueTitleUpdated イベントを返す", async () => {
      const issue = makeIssue();
      const repo = mockIssueRepo(issue);
      const useCase = updateIssueUseCase(repo);

      const result = await useCase({
        issueId: issue.id,
        title: "新しいタイトル",
        actorId,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.events).toHaveLength(1);
      expect(result.value.events[0].type).toBe("IssueTitleUpdated");
    });

    it("種別を変更し、IssueCategoryChanged イベントを返す", async () => {
      const issue = makeIssue();
      const repo = mockIssueRepo(issue);
      const useCase = updateIssueUseCase(repo);

      const result = await useCase({
        issueId: issue.id,
        category: "safety_hazard",
        actorId,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.events).toHaveLength(1);
      expect(result.value.events[0].type).toBe("IssueCategoryChanged");
    });

    it("担当者を変更し、IssueAssigneeChanged イベントを返す", async () => {
      const issue = makeIssue();
      const repo = mockIssueRepo(issue);
      const useCase = updateIssueUseCase(repo);

      const result = await useCase({
        issueId: issue.id,
        assigneeId: "user-2" as UserId,
        actorId,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.events).toHaveLength(1);
      expect(result.value.events[0].type).toBe("IssueAssigneeChanged");
    });

    it("複数フィールドを同時に更新し、複数イベントを返す", async () => {
      const issue = makeIssue();
      const repo = mockIssueRepo(issue);
      const useCase = updateIssueUseCase(repo);

      const result = await useCase({
        issueId: issue.id,
        title: "更新タイトル",
        category: "safety_hazard",
        assigneeId: "user-2" as UserId,
        actorId,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.events).toHaveLength(3);
      expect(result.value.events[0].type).toBe("IssueTitleUpdated");
      expect(result.value.events[1].type).toBe("IssueCategoryChanged");
      expect(result.value.events[2].type).toBe("IssueAssigneeChanged");
    });

    it("複数イベントの version が正しくインクリメントされる", async () => {
      const issue = makeIssue();
      const repo = mockIssueRepo(issue);
      const useCase = updateIssueUseCase(repo);

      const result = await useCase({
        issueId: issue.id,
        title: "更新タイトル",
        category: "safety_hazard",
        actorId,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.events[0].version).toBe(issue.version + 1);
      expect(result.value.events[1].version).toBe(issue.version + 2);
    });

    it("save が元の version で呼ばれる（楽観的同時実行制御）", async () => {
      const issue = makeIssue();
      const repo = mockIssueRepo(issue);
      const useCase = updateIssueUseCase(repo);

      await useCase({
        issueId: issue.id,
        title: "更新タイトル",
        actorId,
      });

      expect(repo.save).toHaveBeenCalledWith(
        issue.id,
        expect.any(Array),
        issue.version,
      );
    });
  });

  describe("異常系", () => {
    it("存在しない Issue の場合、ISSUE_NOT_FOUND エラーを返す", async () => {
      const repo = mockIssueRepo(null);
      const useCase = updateIssueUseCase(repo);

      const result = await useCase({
        issueId: "non-existent" as IssueId,
        title: "タイトル",
        actorId,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("ISSUE_NOT_FOUND");
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("変更フィールドが指定されない場合、NO_CHANGES エラーを返す", async () => {
      const issue = makeIssue();
      const repo = mockIssueRepo(issue);
      const useCase = updateIssueUseCase(repo);

      const result = await useCase({
        issueId: issue.id,
        actorId,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NO_CHANGES");
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("タイトルが空の場合、EMPTY_TITLE エラーを返す", async () => {
      const issue = makeIssue();
      const repo = mockIssueRepo(issue);
      const useCase = updateIssueUseCase(repo);

      const result = await useCase({
        issueId: issue.id,
        title: "",
        actorId,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("EMPTY_TITLE");
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("同じ値への更新の場合、NO_CHANGE エラーを返す", async () => {
      const issue = makeIssue();
      const repo = mockIssueRepo(issue);
      const useCase = updateIssueUseCase(repo);

      const result = await useCase({
        issueId: issue.id,
        title: "外壁タイルの浮き", // 既存と同じ
        actorId,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NO_CHANGE");
    });

    it("save が失敗した場合、SAVE_FAILED エラーを返す", async () => {
      const issue = makeIssue();
      const repo = mockIssueRepo(issue, {
        save: vi.fn().mockRejectedValue(new Error("Concurrency conflict")),
      });
      const useCase = updateIssueUseCase(repo);

      const result = await useCase({
        issueId: issue.id,
        title: "新しいタイトル",
        actorId,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("SAVE_FAILED");
      expect(result.error.message).toContain("Concurrency conflict");
    });
  });
});
