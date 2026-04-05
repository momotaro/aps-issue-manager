import { describe, expect, it, vi } from "vitest";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import {
  generateId,
  type IssueId,
  type ProjectId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";
import type { CreateIssueInput } from "./createIssueUseCase.js";
import { createIssueUseCase } from "./createIssueUseCase.js";

// ---------------------------------------------------------------------------
// テストヘルパー
// ---------------------------------------------------------------------------

const mockIssueRepo = (
  overrides?: Partial<IssueRepository>,
): IssueRepository => ({
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
  getSnapshot: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeValidInput = (): CreateIssueInput => ({
  issueId: generateId<IssueId>(),
  projectId: "project-1" as ProjectId,
  title: "外壁タイルの浮き",
  description: "北側外壁3階部分にタイルの浮きを確認",
  category: "quality_defect",
  position: createSpatialPosition(1.0, 2.0, 3.0),
  reporterId: "user-1" as UserId,
});

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("createIssueUseCase", () => {
  describe("正常系", () => {
    it("指摘を作成し、IssueCreated イベントを返す", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo);

      const result = await useCase(makeValidInput());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.event.type).toBe("IssueCreated");
      expect(result.value.event.payload.title).toBe("外壁タイルの浮き");
      expect(result.value.event.payload.projectId).toBe("project-1");
      expect(result.value.event.payload.status).toBe("open");
      expect(result.value.issueId).toBe(result.value.event.issueId);
    });

    it("save が version 0 で呼ばれる（新規集約）", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo);

      const result = await useCase(makeValidInput());
      if (!result.ok) return;

      expect(repo.save).toHaveBeenCalledWith(
        result.value.issueId,
        [result.value.event],
        0,
      );
    });

    it("assigneeId を指定した場合、イベントに含まれる", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo);

      const result = await useCase({
        ...makeValidInput(),
        assigneeId: "user-2" as UserId,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.event.payload.assigneeId).toBe("user-2");
    });

    it("assigneeId を省略した場合、null になる", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo);

      const result = await useCase(makeValidInput());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.event.payload.assigneeId).toBeNull();
    });

    it("photos を省略した場合、空配列になる", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo);

      const result = await useCase(makeValidInput());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.event.payload.photos).toEqual([]);
    });
  });

  describe("異常系", () => {
    it("タイトルが空の場合、EMPTY_TITLE エラーを返す", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo);

      const result = await useCase({ ...makeValidInput(), title: "" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("EMPTY_TITLE");
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("タイトルが空白のみの場合、EMPTY_TITLE エラーを返す", async () => {
      const repo = mockIssueRepo();
      const useCase = createIssueUseCase(repo);

      const result = await useCase({ ...makeValidInput(), title: "   " });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("EMPTY_TITLE");
    });

    it("save が失敗した場合、SAVE_FAILED エラーを返す", async () => {
      const repo = mockIssueRepo({
        save: vi.fn().mockRejectedValue(new Error("DB connection failed")),
      });
      const useCase = createIssueUseCase(repo);

      const result = await useCase(makeValidInput());

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("SAVE_FAILED");
      expect(result.error.message).toContain("DB connection failed");
    });
  });
});
