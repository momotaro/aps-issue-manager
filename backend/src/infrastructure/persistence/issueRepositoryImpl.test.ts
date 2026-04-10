import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ConcurrencyError } from "../../domain/services/errors.js";
import {
  generateId,
  type IssueId,
} from "../../domain/valueObjects/brandedId.js";
import { createEventProjector } from "./eventProjectorImpl.js";
import { createEventStore } from "./eventStoreImpl.js";
import { createIssueRepository } from "./issueRepositoryImpl.js";
import {
  makeIssueCreatedEvent,
  makeTitleUpdatedEvent,
} from "./testFixtures.js";
import { cleanTables, closeTestDb, getTestDb } from "./testHelper.js";

describe("issueRepositoryImpl（結合テスト）", () => {
  const db = getTestDb();
  const eventStoreFactory = createEventStore(db);
  const eventProjectorFactory = createEventProjector(db);
  const repo = createIssueRepository(
    db,
    eventStoreFactory,
    eventProjectorFactory,
  );

  beforeEach(async () => {
    await cleanTables(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // --- 正常系 ---

  it("save → load でラウンドトリップできる", async () => {
    const created = makeIssueCreatedEvent();
    const issueId = created.issueId;

    await repo.save(issueId, [created], 0);

    const issue = await repo.load(issueId);
    expect(issue).not.toBeNull();
    expect(issue?.id).toBe(issueId);
    expect(issue?.title).toBe("テスト指摘");
    expect(issue?.status).toBe("open");
    expect(issue?.version).toBe(1);
    expect(issue?.comments).toEqual([]);
  });

  it("複数イベントの適用で最新状態が復元される", async () => {
    const created = makeIssueCreatedEvent();
    const issueId = created.issueId;
    await repo.save(issueId, [created], 0);

    const titleUpdated = makeTitleUpdatedEvent(issueId, 2, "更新タイトル");
    await repo.save(issueId, [titleUpdated], 1);

    const issue = await repo.load(issueId);
    expect(issue?.title).toBe("更新タイトル");
    expect(issue?.version).toBe(2);
  });

  it("スナップショット保存 → スナップショット + 差分で復元できる", async () => {
    const created = makeIssueCreatedEvent();
    const issueId = created.issueId;
    await repo.save(issueId, [created], 0);

    const issue = await repo.load(issueId);
    // biome-ignore lint/style/noNonNullAssertion: テストで toBeNull() 検証済み
    await repo.saveSnapshot({ state: issue!, version: issue!.version });

    const titleUpdated = makeTitleUpdatedEvent(issueId, 2, "スナップ後");
    await repo.save(issueId, [titleUpdated], 1);

    const restored = await repo.load(issueId);
    expect(restored?.title).toBe("スナップ後");
    expect(restored?.version).toBe(2);
  });

  it("スナップショットを getSnapshot で取得できる", async () => {
    const created = makeIssueCreatedEvent();
    const issueId = created.issueId;
    await repo.save(issueId, [created], 0);

    const issue = await repo.load(issueId);
    // biome-ignore lint/style/noNonNullAssertion: テストで toBeNull() 検証済み
    await repo.saveSnapshot({ state: issue!, version: 1 });

    const snapshot = await repo.getSnapshot(issueId);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.version).toBe(1);
    expect(snapshot?.state.title).toBe("テスト指摘");
  });

  // --- 異常系 ---

  it("存在しない ID で load すると null を返す", async () => {
    const issue = await repo.load(generateId<IssueId>());
    expect(issue).toBeNull();
  });

  it("version 競合で ConcurrencyError をスローする", async () => {
    const created = makeIssueCreatedEvent();
    const issueId = created.issueId;
    await repo.save(issueId, [created], 0);

    const update1 = makeTitleUpdatedEvent(issueId, 2, "更新1");
    const update2 = makeTitleUpdatedEvent(issueId, 2, "更新2");

    await repo.save(issueId, [update1], 1);
    await expect(repo.save(issueId, [update2], 1)).rejects.toThrow(
      ConcurrencyError,
    );
  });

  // --- 境界値 ---

  it("スナップショットなしの load は全イベント再生で復元する", async () => {
    const created = makeIssueCreatedEvent();
    const issueId = created.issueId;
    await repo.save(issueId, [created], 0);

    const snapshot = await repo.getSnapshot(issueId);
    expect(snapshot).toBeNull();

    const issue = await repo.load(issueId);
    expect(issue).not.toBeNull();
    expect(issue?.version).toBe(1);
  });
});
