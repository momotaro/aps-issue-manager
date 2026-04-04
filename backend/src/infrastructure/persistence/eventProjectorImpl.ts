import { eq, sql } from "drizzle-orm";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import type { EventProjector } from "../../domain/services/eventProjector.js";
import { issuesRead } from "./schema.js";
import type { Db, Tx } from "./types.js";

/** トランザクション対応の EventProjector を生成する高階関数。 */
export const createEventProjector =
  (db: Db) =>
  (tx?: Tx): EventProjector => {
    const executor = tx ?? db;

    return {
      project: async (events: readonly IssueDomainEvent[]): Promise<void> => {
        for (const event of events) {
          if (event.type === "IssueCreated") {
            const { payload } = event;
            await executor.insert(issuesRead).values({
              id: event.issueId,
              projectId: payload.projectId,
              title: payload.title,
              description: payload.description,
              status: payload.status,
              category: payload.category,
              positionType: payload.position.type,
              positionData: payload.position as unknown as Record<
                string,
                unknown
              >,
              reporterId: payload.reporterId,
              assigneeId: payload.assigneeId,
              photoCount: payload.photos.length,
              photos: payload.photos as unknown as Record<string, unknown>[],
              version: event.version,
              createdAt: event.occurredAt,
              updatedAt: event.occurredAt,
            });
            continue;
          }

          const updates = eventToUpdates(event);
          await executor
            .update(issuesRead)
            .set({
              ...updates,
              version: event.version,
              updatedAt: event.occurredAt,
            })
            .where(eq(issuesRead.id, event.issueId));
        }
      },
    };
  };

const eventToUpdates = (
  event: Exclude<IssueDomainEvent, { type: "IssueCreated" }>,
): Record<string, unknown> => {
  switch (event.type) {
    case "IssueTitleUpdated":
      return { title: event.payload.title };
    case "IssueDescriptionUpdated":
      return { description: event.payload.description };
    case "IssueStatusChanged":
      return { status: event.payload.to };
    case "IssueCategoryChanged":
      return { category: event.payload.category };
    case "IssueAssigneeChanged":
      return { assigneeId: event.payload.assigneeId };
    case "PhotoAdded": {
      const appended = sql`${issuesRead.photos} || ${JSON.stringify([event.payload.photo])}::jsonb`;
      return {
        photos: appended,
        photoCount: sql`jsonb_array_length(${appended})`,
      };
    }
    case "PhotoRemoved": {
      const filtered = sql`COALESCE((
          SELECT jsonb_agg(elem)
          FROM jsonb_array_elements(${issuesRead.photos}) AS elem
          WHERE elem->>'id' != ${event.payload.photoId}
        ), '[]'::jsonb)`;
      return {
        photos: filtered,
        photoCount: sql`jsonb_array_length(${filtered})`,
      };
    }
  }
};
