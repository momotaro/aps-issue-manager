import { eq, sql } from "drizzle-orm";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import type { EventProjector } from "../../domain/services/eventProjector.js";
import { comments, issuesRead } from "./schema.js";
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
              status: payload.status,
              category: payload.category,
              positionType: payload.position.type,
              positionData: payload.position as unknown as Record<
                string,
                unknown
              >,
              reporterId: payload.reporterId,
              assigneeId: payload.assigneeId,
              version: event.version,
              createdAt: event.occurredAt,
              updatedAt: event.occurredAt,
            });
            continue;
          }

          if (event.type === "CommentAdded") {
            const { comment } = event.payload;
            // comments テーブルに追記（attachments 含む）
            await executor.insert(comments).values({
              id: comment.commentId,
              issueId: event.issueId,
              body: comment.body,
              actorId: comment.actorId,
              attachments: comment.attachments as unknown as Record<
                string,
                unknown
              >[],
              createdAt: comment.createdAt,
            });
            // issues_read.recent_comments を最新5件に維持
            const commentJson = JSON.stringify([comment]);
            const updatedRecentComments = sql`(
              SELECT jsonb_agg(c)
              FROM (
                SELECT elem AS c
                FROM jsonb_array_elements(
                  ${issuesRead.recentComments} || ${commentJson}::jsonb
                ) AS elem
                ORDER BY elem->>'createdAt' DESC
                LIMIT 5
              ) sub
            )`;
            await executor
              .update(issuesRead)
              .set({
                recentComments: updatedRecentComments,
                version: event.version,
                updatedAt: event.occurredAt,
              })
              .where(eq(issuesRead.id, event.issueId));
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
  event: Exclude<IssueDomainEvent, { type: "IssueCreated" | "CommentAdded" }>,
): Record<string, unknown> => {
  switch (event.type) {
    case "IssueTitleUpdated":
      return { title: event.payload.title };
    case "IssueStatusChanged":
      return { status: event.payload.to };
    case "IssueCategoryChanged":
      return { category: event.payload.category };
    case "IssueAssigneeChanged":
      return { assigneeId: event.payload.assigneeId };
  }
};
