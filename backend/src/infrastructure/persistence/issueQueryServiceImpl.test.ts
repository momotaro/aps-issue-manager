import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createEventMeta } from "../../domain/events/eventMeta.js";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import {
  type CommentId,
  generateId,
  type IssueId,
  type ProjectId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createComment } from "../../domain/valueObjects/comment.js";
import { createEventProjector } from "./eventProjectorImpl.js";
import { createEventStore } from "./eventStoreImpl.js";
import { createIssueQueryService } from "./issueQueryServiceImpl.js";
import { createIssueRepository } from "./issueRepositoryImpl.js";
import {
  makeIssueCreatedEvent,
  makeStatusChangedEvent,
  makeTestUser,
  testActorId,
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

  it("findAll で assigneeId フィルタが効く", async () => {
    const assigneeId = generateId<UserId>();
    const e1 = await createIssue();
    // e1 に担当者を割り当て
    const assignEvent = {
      ...createEventMeta(e1.issueId, testActorId, 2),
      type: "IssueAssigneeChanged" as const,
      payload: { assigneeId },
    };
    await issueRepo.save(e1.issueId, [assignEvent], 1);

    await createIssue(); // 担当者なし

    const items = await queryService.findAll({ assigneeId });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(e1.issueId);
  });

  it("findAll の結果は updatedAt DESC でソートされる", async () => {
    // 確実に時刻差を作るため、sleep で分離
    const e1 = await createIssue({ title: "古い指摘" });
    await new Promise((r) => setTimeout(r, 50));
    const e2 = await createIssue({ title: "新しい指摘" });

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

  // --- recentComments ---

  it("findById でコメントが0件のとき recentComments は空配列を返す", async () => {
    const event = await createIssue();
    const detail = await queryService.findById(event.issueId);
    expect(detail?.recentComments).toEqual([]);
  });

  it("findById で recentComments が返される", async () => {
    const event = await createIssue();
    const meta = createEventMeta(event.issueId, testActorId, 2);
    const comment = createComment({
      commentId: generateId<CommentId>(),
      body: "テストコメント",
      actorId: testActorId,
      attachments: [],
      createdAt: meta.occurredAt,
    });
    const commentEvent: IssueDomainEvent = {
      ...meta,
      type: "CommentAdded",
      payload: { comment },
    };
    await issueRepo.save(event.issueId, [commentEvent], 1);

    const detail = await queryService.findById(event.issueId);
    expect(detail?.recentComments).toHaveLength(1);
    expect(detail?.recentComments[0].body).toBe("テストコメント");
    expect(detail?.recentComments[0].attachments).toEqual([]);
  });

  it("findById で recentComments[*].createdAt が Date 型である", async () => {
    const event = await createIssue();
    const meta = createEventMeta(event.issueId, testActorId, 2);
    const comment = createComment({
      commentId: generateId<CommentId>(),
      body: "日付テスト",
      actorId: testActorId,
      attachments: [],
      createdAt: meta.occurredAt,
    });
    const commentEvent: IssueDomainEvent = {
      ...meta,
      type: "CommentAdded",
      payload: { comment },
    };
    await issueRepo.save(event.issueId, [commentEvent], 1);

    const detail = await queryService.findById(event.issueId);
    expect(detail?.recentComments[0].createdAt).toBeInstanceOf(Date);
  });
});
