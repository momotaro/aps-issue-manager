import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ConcurrencyError } from "../../domain/services/errors.js";
import {
  generateId,
  type IssueId,
} from "../../domain/valueObjects/brandedId.js";
import { createEventStore } from "./eventStoreImpl.js";
import {
  makeIssueCreatedEvent,
  makeTitleUpdatedEvent,
} from "./testFixtures.js";
import { cleanTables, closeTestDb, getTestDb } from "./testHelper.js";

describe("eventStoreImpl（結合テスト）", () => {
  const db = getTestDb();
  const factory = createEventStore(db);
  const eventStore = factory();

  beforeEach(async () => {
    await cleanTables(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // --- 正常系 ---

  it("イベントを追記し、version 昇順で取得できる", async () => {
    const created = makeIssueCreatedEvent();
    const issueId = created.issueId;

    await eventStore.append(issueId, [created], 0);

    const titleUpdated = makeTitleUpdatedEvent(issueId, 2, "更新後タイトル");
    await eventStore.append(issueId, [titleUpdated], 1);

    const events = await eventStore.getEvents(issueId);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("IssueCreated");
    expect(events[0].version).toBe(1);
    expect(events[1].type).toBe("IssueTitleUpdated");
    expect(events[1].version).toBe(2);
  });

  it("afterVersion で差分イベントのみ取得できる", async () => {
    const created = makeIssueCreatedEvent();
    const issueId = created.issueId;

    await eventStore.append(issueId, [created], 0);
    const titleUpdated = makeTitleUpdatedEvent(issueId, 2, "v2タイトル");
    await eventStore.append(issueId, [titleUpdated], 1);

    const events = await eventStore.getEvents(issueId, 1);
    expect(events).toHaveLength(1);
    expect(events[0].version).toBe(2);
  });

  it("複数イベントをバッチで追記できる", async () => {
    const created = makeIssueCreatedEvent();
    const issueId = created.issueId;
    const title2 = makeTitleUpdatedEvent(issueId, 2, "タイトル2");
    const title3 = makeTitleUpdatedEvent(issueId, 3, "タイトル3");

    await eventStore.append(issueId, [created], 0);
    await eventStore.append(issueId, [title2, title3], 1);

    const events = await eventStore.getEvents(issueId);
    expect(events).toHaveLength(3);
  });

  it("空イベント配列の append は何もしない", async () => {
    const issueId = generateId<IssueId>();
    await eventStore.append(issueId, [], 0);

    const events = await eventStore.getEvents(issueId);
    expect(events).toHaveLength(0);
  });

  // --- 異常系 ---

  it("version 競合時に ConcurrencyError をスローする", async () => {
    const created = makeIssueCreatedEvent();
    const issueId = created.issueId;

    await eventStore.append(issueId, [created], 0);

    const duplicate = makeTitleUpdatedEvent(issueId, 1, "競合");
    await expect(eventStore.append(issueId, [duplicate], 0)).rejects.toThrow(
      ConcurrencyError,
    );
  });

  // --- 境界値 ---

  it("存在しない集約の getEvents は空配列を返す", async () => {
    const events = await eventStore.getEvents(generateId<IssueId>());
    expect(events).toHaveLength(0);
  });
});
