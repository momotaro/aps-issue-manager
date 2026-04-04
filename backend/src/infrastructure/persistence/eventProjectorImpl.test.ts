import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createEventMeta } from "../../domain/events/eventMeta.js";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import {
  generateId,
  type PhotoId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createPhoto } from "../../domain/valueObjects/photo.js";
import { createEventProjector } from "./eventProjectorImpl.js";
import { issuesRead } from "./schema.js";
import { makeIssueCreatedEvent, testActorId } from "./testFixtures.js";
import { cleanTables, closeTestDb, getTestDb } from "./testHelper.js";

describe("eventProjectorImpl（結合テスト）", () => {
  const db = getTestDb();
  const factory = createEventProjector(db);
  const projector = factory();

  beforeEach(async () => {
    await cleanTables(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  const projectCreated = async () => {
    const event = makeIssueCreatedEvent();
    await projector.project([event]);
    return event;
  };

  it("IssueCreated で issues_read に INSERT される", async () => {
    const event = await projectCreated();

    const rows = await db
      .select()
      .from(issuesRead)
      .where(eq(issuesRead.id, event.issueId));

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("テスト指摘");
    expect(rows[0].status).toBe("open");
    expect(rows[0].version).toBe(1);
    expect(rows[0].photoCount).toBe(0);
  });

  it("IssueTitleUpdated で title が UPDATE される", async () => {
    const created = await projectCreated();
    const event: IssueDomainEvent = {
      ...createEventMeta(created.issueId, testActorId, 2),
      type: "IssueTitleUpdated",
      payload: { title: "更新後タイトル" },
    };
    await projector.project([event]);

    const rows = await db
      .select()
      .from(issuesRead)
      .where(eq(issuesRead.id, created.issueId));
    expect(rows[0].title).toBe("更新後タイトル");
    expect(rows[0].version).toBe(2);
  });

  it("IssueDescriptionUpdated で description が UPDATE される", async () => {
    const created = await projectCreated();
    const event: IssueDomainEvent = {
      ...createEventMeta(created.issueId, testActorId, 2),
      type: "IssueDescriptionUpdated",
      payload: { description: "更新後説明" },
    };
    await projector.project([event]);

    const rows = await db
      .select()
      .from(issuesRead)
      .where(eq(issuesRead.id, created.issueId));
    expect(rows[0].description).toBe("更新後説明");
  });

  it("IssueStatusChanged で status が UPDATE される", async () => {
    const created = await projectCreated();
    const event: IssueDomainEvent = {
      ...createEventMeta(created.issueId, testActorId, 2),
      type: "IssueStatusChanged",
      payload: { from: "open", to: "in_progress" },
    };
    await projector.project([event]);

    const rows = await db
      .select()
      .from(issuesRead)
      .where(eq(issuesRead.id, created.issueId));
    expect(rows[0].status).toBe("in_progress");
  });

  it("IssueCategoryChanged で category が UPDATE される", async () => {
    const created = await projectCreated();
    const event: IssueDomainEvent = {
      ...createEventMeta(created.issueId, testActorId, 2),
      type: "IssueCategoryChanged",
      payload: { category: "safety_hazard" },
    };
    await projector.project([event]);

    const rows = await db
      .select()
      .from(issuesRead)
      .where(eq(issuesRead.id, created.issueId));
    expect(rows[0].category).toBe("safety_hazard");
  });

  it("IssueAssigneeChanged で assigneeId が UPDATE される", async () => {
    const created = await projectCreated();
    const assigneeId = generateId<UserId>();
    const event: IssueDomainEvent = {
      ...createEventMeta(created.issueId, testActorId, 2),
      type: "IssueAssigneeChanged",
      payload: { assigneeId },
    };
    await projector.project([event]);

    const rows = await db
      .select()
      .from(issuesRead)
      .where(eq(issuesRead.id, created.issueId));
    expect(rows[0].assigneeId).toBe(assigneeId);
  });

  it("PhotoAdded で photoCount がインクリメントされる", async () => {
    const created = await projectCreated();
    const photo = createPhoto({
      id: generateId<PhotoId>(),
      fileName: "test.jpg",
      storagePath: "confirmed/xxx/before/test.jpg",
      phase: "before",
      uploadedAt: new Date(),
    });
    const event: IssueDomainEvent = {
      ...createEventMeta(created.issueId, testActorId, 2),
      type: "PhotoAdded",
      payload: { photo },
    };
    await projector.project([event]);

    const rows = await db
      .select()
      .from(issuesRead)
      .where(eq(issuesRead.id, created.issueId));
    expect(rows[0].photoCount).toBe(1);
    const photos = rows[0].photos as Array<{ id: string; fileName: string }>;
    expect(photos).toHaveLength(1);
    expect(photos[0].id).toBe(photo.id);
    expect(photos[0].fileName).toBe("test.jpg");
  });

  it("複数イベントを一括で project できる", async () => {
    const created = makeIssueCreatedEvent();
    const titleUpdated: IssueDomainEvent = {
      ...createEventMeta(created.issueId, testActorId, 2),
      type: "IssueTitleUpdated",
      payload: { title: "一括投影タイトル" },
    };

    await projector.project([created, titleUpdated]);

    const rows = await db
      .select()
      .from(issuesRead)
      .where(eq(issuesRead.id, created.issueId));
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("一括投影タイトル");
    expect(rows[0].version).toBe(2);
  });

  it("PhotoRemoved で photoCount がデクリメントされる", async () => {
    const created = await projectCreated();
    const photoId = generateId<PhotoId>();
    const photo = createPhoto({
      id: photoId,
      fileName: "test.jpg",
      storagePath: "confirmed/xxx/before/test.jpg",
      phase: "before",
      uploadedAt: new Date(),
    });

    const addEvent: IssueDomainEvent = {
      ...createEventMeta(created.issueId, testActorId, 2),
      type: "PhotoAdded",
      payload: { photo },
    };
    await projector.project([addEvent]);

    const removeEvent: IssueDomainEvent = {
      ...createEventMeta(created.issueId, testActorId, 3),
      type: "PhotoRemoved",
      payload: { photoId },
    };
    await projector.project([removeEvent]);

    const rows = await db
      .select()
      .from(issuesRead)
      .where(eq(issuesRead.id, created.issueId));
    expect(rows[0].photoCount).toBe(0);
    const photos = rows[0].photos as Array<unknown>;
    expect(photos).toHaveLength(0);
  });
});
