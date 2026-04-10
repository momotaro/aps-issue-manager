import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createEventMeta } from "../../domain/events/eventMeta.js";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import {
  type CommentId,
  generateId,
  type PhotoId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { createComment } from "../../domain/valueObjects/comment.js";
import { createPhoto } from "../../domain/valueObjects/photo.js";
import { createEventProjector } from "./eventProjectorImpl.js";
import { comments, issuesRead } from "./schema.js";
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

  // ---------------------------------------------------------------------------
  // CommentAdded
  // ---------------------------------------------------------------------------

  describe("CommentAdded", () => {
    const makeCommentAddedEvent = (
      issueId: ReturnType<typeof makeIssueCreatedEvent>["issueId"],
      version: number,
      attachments?: ReturnType<typeof createPhoto>[],
    ): IssueDomainEvent => {
      const meta = createEventMeta(issueId, testActorId, version);
      const comment = createComment({
        commentId: generateId<CommentId>(),
        body: `コメント${version}`,
        actorId: testActorId,
        attachments: attachments ?? [],
        createdAt: meta.occurredAt,
      });
      return {
        ...meta,
        type: "CommentAdded",
        payload: { comment },
      };
    };

    it("CommentAdded で comments テーブルに INSERT される", async () => {
      const created = await projectCreated();
      const event = makeCommentAddedEvent(created.issueId, 2);
      await projector.project([event]);

      const rows = await db
        .select()
        .from(comments)
        .where(eq(comments.issueId, created.issueId));
      expect(rows).toHaveLength(1);
      expect(rows[0].body).toBe("コメント2");
      expect(rows[0].actorId).toBe(testActorId);
      expect(rows[0].issueId).toBe(created.issueId);
    });

    it("CommentAdded で comments テーブルに attachments JSONB が格納される", async () => {
      const created = await projectCreated();
      const photoId = generateId<PhotoId>();
      const photo = createPhoto({
        id: photoId,
        fileName: "test.jpg",
        storagePath: "confirmed/xxx/cmt/test.jpg",
        uploadedAt: new Date("2026-01-15T10:00:00Z"),
      });
      const event = makeCommentAddedEvent(created.issueId, 2, [photo]);
      await projector.project([event]);

      const rows = await db
        .select()
        .from(comments)
        .where(eq(comments.issueId, created.issueId));
      expect(rows).toHaveLength(1);
      const attachments = rows[0].attachments as Array<{
        id: string;
        fileName: string;
      }>;
      expect(attachments).toHaveLength(1);
      expect(attachments[0].id).toBe(photoId);
      expect(attachments[0].fileName).toBe("test.jpg");
    });

    it("CommentAdded で issues_read.recent_comments が更新される", async () => {
      const created = await projectCreated();
      const event = makeCommentAddedEvent(created.issueId, 2);
      await projector.project([event]);

      const rows = await db
        .select()
        .from(issuesRead)
        .where(eq(issuesRead.id, created.issueId));
      const recentComments = rows[0].recentComments as Array<{
        body: string;
      }>;
      expect(recentComments).toHaveLength(1);
      expect(recentComments[0].body).toBe("コメント2");
    });

    it("CommentAdded × 6回で recent_comments は最新5件のみ保持される", async () => {
      const created = await projectCreated();
      const events: IssueDomainEvent[] = Array.from({ length: 6 }, (_, i) =>
        makeCommentAddedEvent(created.issueId, i + 2),
      );
      await projector.project(events);

      const rows = await db
        .select()
        .from(issuesRead)
        .where(eq(issuesRead.id, created.issueId));
      const recentComments = rows[0].recentComments as Array<{
        body: string;
      }>;
      expect(recentComments).toHaveLength(5);

      // comments テーブルには全6件が INSERT されている
      const commentRows = await db
        .select()
        .from(comments)
        .where(eq(comments.issueId, created.issueId));
      expect(commentRows).toHaveLength(6);
    });
  });
});
