import { eq } from "drizzle-orm";
import type { Issue } from "../../domain/entities/issue.js";
import {
  rehydrate,
  rehydrateFromSnapshot,
} from "../../domain/entities/issue.js";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import type {
  IssueRepository,
  IssueSnapshot,
} from "../../domain/repositories/issueRepository.js";
import type { IssueId, UserId } from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import type { createEventProjector } from "./eventProjectorImpl.js";
import type { createEventStore } from "./eventStoreImpl.js";
import { restoreCommentDates } from "./issueQueryServiceImpl.js";
import { comments, issueEvents, issueSnapshots, issuesRead } from "./schema.js";
import type { Db } from "./types.js";

type EventStoreFactory = ReturnType<typeof createEventStore>;
type EventProjectorFactory = ReturnType<typeof createEventProjector>;

/** IssueRepository を生成する高階関数。 */
export const createIssueRepository = (
  db: Db,
  eventStoreFactory: EventStoreFactory,
  eventProjectorFactory: EventProjectorFactory,
): IssueRepository => ({
  load: async (id: IssueId): Promise<Issue | null> => {
    const snapshot = await loadSnapshot(db, id);
    const eventStore = eventStoreFactory();

    if (snapshot) {
      const events = await eventStore.getEvents(id, snapshot.version);
      return events.length === 0
        ? snapshot.state
        : rehydrateFromSnapshot(snapshot.state, events);
    }

    const events = await eventStore.getEvents(id);
    return rehydrate(events);
  },

  save: async (
    id: IssueId,
    events: readonly IssueDomainEvent[],
    expectedVersion: number,
  ): Promise<void> => {
    await db.transaction(async (tx) => {
      const eventStore = eventStoreFactory(tx);
      const projector = eventProjectorFactory(tx);

      await eventStore.append(id, events, expectedVersion);
      await projector.project(events);
    });
  },

  saveSnapshot: async (snapshot: IssueSnapshot): Promise<void> => {
    const now = new Date();
    const stateJson = snapshotToJson(snapshot.state);
    await db
      .insert(issueSnapshots)
      .values({
        issueId: snapshot.state.id,
        state: stateJson,
        version: snapshot.version,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: issueSnapshots.issueId,
        set: {
          state: stateJson,
          version: snapshot.version,
          createdAt: now,
        },
      });
  },

  getSnapshot: async (id: IssueId): Promise<IssueSnapshot | null> => {
    return loadSnapshot(db, id);
  },

  delete: async (id: IssueId): Promise<void> => {
    await db.transaction(async (tx) => {
      await tx.delete(issueSnapshots).where(eq(issueSnapshots.issueId, id));
      await tx.delete(comments).where(eq(comments.issueId, id));
      await tx.delete(issuesRead).where(eq(issuesRead.id, id));
      await tx.delete(issueEvents).where(eq(issueEvents.issueId, id));
    });
  },
});

const loadSnapshot = async (
  db: Db,
  id: IssueId,
): Promise<IssueSnapshot | null> => {
  const rows = await db
    .select()
    .from(issueSnapshots)
    .where(eq(issueSnapshots.issueId, id));

  if (rows.length === 0) return null;

  const row = rows[0];
  const state = row.state as Record<string, unknown>;

  const issue: Issue = {
    id: parseId<IssueId>(state.id as string),
    projectId: parseId<Issue["projectId"]>(state.projectId as string),
    title: state.title as string,
    status: state.status as Issue["status"],
    category: state.category as Issue["category"],
    position: state.position as Issue["position"],
    reporterId: parseId<UserId>(state.reporterId as string),
    assigneeId: state.assigneeId
      ? parseId<UserId>(state.assigneeId as string)
      : null,
    comments: restoreCommentDates(
      state.comments as Array<Record<string, unknown>>,
    ),
    version: row.version,
    createdAt: new Date(state.createdAt as string),
    updatedAt: new Date(state.updatedAt as string),
  };

  return { state: Object.freeze(issue), version: row.version };
};

const snapshotToJson = (issue: Issue): Record<string, unknown> => ({
  id: issue.id,
  projectId: issue.projectId,
  title: issue.title,
  status: issue.status,
  category: issue.category,
  position: issue.position,
  reporterId: issue.reporterId,
  assigneeId: issue.assigneeId,
  comments: issue.comments.map((c) => ({
    ...c,
    attachments: c.attachments.map((p) => ({
      ...p,
      uploadedAt: p.uploadedAt.toISOString(),
    })),
    createdAt: c.createdAt.toISOString(),
  })),
  version: issue.version,
  createdAt: issue.createdAt.toISOString(),
  updatedAt: issue.updatedAt.toISOString(),
});
