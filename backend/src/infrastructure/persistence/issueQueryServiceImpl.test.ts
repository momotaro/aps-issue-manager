import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateId,
  type IssueId,
  type ProjectId,
} from "../../domain/valueObjects/brandedId.js";
import { createEventProjector } from "./eventProjectorImpl.js";
import { createEventStore } from "./eventStoreImpl.js";
import { createIssueQueryService } from "./issueQueryServiceImpl.js";
import { createIssueRepository } from "./issueRepositoryImpl.js";
import {
  makeIssueCreatedEvent,
  makeStatusChangedEvent,
  makeTestUser,
  testProjectId,
  testReporterId,
} from "./testFixtures.js";
import { cleanTables, closeTestDb, getTestDb } from "./testHelper.js";
import { createUserRepository } from "./userRepositoryImpl.js";

describe("issueQueryServiceImpl（結合テスト）", () => {
  const db = getTestDb();
  const queryService = createIssueQueryService(db);
  const eventStoreFactory = createEventStore(db);
  const eventProjectorFactory = createEventProjector(db);
  const issueRepo = createIssueRepository(
    db,
    eventStoreFactory,
    eventProjectorFactory,
  );
  const userRepo = createUserRepository(db);

  beforeEach(async () => {
    await cleanTables(db);
    // テスト用ユーザーを事前登録（reporterName 解決用）
    const reporter = makeTestUser({
      name: "報告者",
      email: "reporter@example.com",
    });
    // reporterId を固定するため直接 save
    await userRepo.save({
      ...reporter,
      id: testReporterId,
    });
  });

  afterAll(async () => {
    await closeTestDb();
  });

  const createIssue = async (
    overrides?: Parameters<typeof makeIssueCreatedEvent>[0],
  ) => {
    const event = makeIssueCreatedEvent(overrides);
    await issueRepo.save(event.issueId, [event], 0);
    return event;
  };

  // --- 正常系 ---

  it("findById で詳細を取得できる（reporterName 含む）", async () => {
    const event = await createIssue();

    const detail = await queryService.findById(event.issueId);
    expect(detail).not.toBeNull();
    expect(detail?.title).toBe("テスト指摘");
    expect(detail?.reporterName).toBe("報告者");
    expect(detail?.assigneeName).toBeNull();
    expect(detail?.description).toBe("テスト用の指摘です");
  });

  it("findAll でフィルタなし全件取得できる", async () => {
    await createIssue({ title: "指摘1" });
    await createIssue({ title: "指摘2" });

    const items = await queryService.findAll();
    expect(items).toHaveLength(2);
  });

  it("findAll で projectId フィルタが効く", async () => {
    const otherProject = generateId<ProjectId>();
    await createIssue({ projectId: testProjectId });
    await createIssue({ projectId: otherProject });

    const items = await queryService.findAll({ projectId: testProjectId });
    expect(items).toHaveLength(1);
  });

  it("findAll で status フィルタが効く", async () => {
    const event = await createIssue();
    const statusEvent = makeStatusChangedEvent(
      event.issueId,
      2,
      "open",
      "in_progress",
    );
    await issueRepo.save(event.issueId, [statusEvent], 1);

    await createIssue(); // open のまま

    const items = await queryService.findAll({ status: "in_progress" });
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("in_progress");
  });

  it("findAll で category フィルタが効く", async () => {
    await createIssue({ category: "safety_hazard" });
    await createIssue({ category: "quality_defect" });

    const items = await queryService.findAll({ category: "safety_hazard" });
    expect(items).toHaveLength(1);
  });

  it("findAll の結果は updatedAt DESC でソートされる", async () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const e1 = await createIssue({ title: "古い指摘" });
    vi.setSystemTime(new Date("2026-01-02T00:00:00Z"));
    const e2 = await createIssue({ title: "新しい指摘" });
    vi.useRealTimers();

    const items = await queryService.findAll();
    // 後に作成された方が先に来る
    expect(items[0].id).toBe(e2.issueId);
    expect(items[1].id).toBe(e1.issueId);
  });

  it("getEventHistory でイベント履歴を取得できる", async () => {
    const event = await createIssue();
    const statusEvent = makeStatusChangedEvent(
      event.issueId,
      2,
      "open",
      "in_progress",
    );
    await issueRepo.save(event.issueId, [statusEvent], 1);

    const history = await queryService.getEventHistory(event.issueId);
    expect(history).toHaveLength(2);
    expect(history[0].version).toBe(1);
    expect(history[1].version).toBe(2);
  });

  // --- 異常系 ---

  it("存在しない ID で findById は null を返す", async () => {
    const detail = await queryService.findById(generateId<IssueId>());
    expect(detail).toBeNull();
  });

  it("存在しない ID で getEventHistory は空配列を返す", async () => {
    const history = await queryService.getEventHistory(generateId<IssueId>());
    expect(history).toHaveLength(0);
  });

  // --- 境界値 ---

  it("フィルタ結果 0 件は空配列を返す", async () => {
    await createIssue();
    const items = await queryService.findAll({ status: "done" });
    expect(items).toHaveLength(0);
  });
});
