import { and, asc, eq, gt } from "drizzle-orm";
import type { EventMeta } from "../../domain/events/eventMeta.js";
import type {
  IssueDomainEvent,
  IssueDomainEventType,
} from "../../domain/events/issueEvents.js";
import type { EventStore } from "../../domain/repositories/eventStore.js";
import { ConcurrencyError } from "../../domain/services/errors.js";
import type { IssueId } from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import { issueEvents } from "./schema.js";
import type { Db, Tx } from "./types.js";

type EventRow = typeof issueEvents.$inferSelect;

const toRow = (event: IssueDomainEvent) => ({
  id: event.id,
  issueId: event.issueId,
  type: event.type,
  payload: event.payload as Record<string, unknown>,
  actorId: event.actorId,
  version: event.version,
  occurredAt: event.occurredAt,
});

const toDomain = (row: EventRow): IssueDomainEvent => {
  const meta: EventMeta = {
    id: parseId(row.id),
    issueId: parseId(row.issueId),
    occurredAt: row.occurredAt,
    actorId: parseId(row.actorId),
    version: row.version,
  };

  return {
    ...meta,
    type: row.type as IssueDomainEventType,
    payload: row.payload,
  } as IssueDomainEvent;
};

/** トランザクション対応の EventStore を生成する高階関数。 */
export const createEventStore =
  (db: Db) =>
  (tx?: Tx): EventStore => {
    const executor = tx ?? db;

    return {
      append: async (
        aggregateId: IssueId,
        events: readonly IssueDomainEvent[],
        expectedVersion: number,
      ): Promise<void> => {
        if (events.length === 0) return;

        try {
          await executor.insert(issueEvents).values(events.map(toRow));
        } catch (error: unknown) {
          if (isUniqueViolation(error)) {
            throw new ConcurrencyError(
              aggregateId,
              expectedVersion,
              expectedVersion,
            );
          }
          throw error;
        }
      },

      getEvents: async (
        aggregateId: IssueId,
        afterVersion?: number,
      ): Promise<readonly IssueDomainEvent[]> => {
        const conditions = [eq(issueEvents.issueId, aggregateId)];
        if (afterVersion !== undefined) {
          conditions.push(gt(issueEvents.version, afterVersion));
        }

        const rows = await executor
          .select()
          .from(issueEvents)
          .where(and(...conditions))
          .orderBy(asc(issueEvents.version));

        return rows.map(toDomain);
      },
    };
  };

/** PostgreSQL の UNIQUE 制約違反（code 23505）を検出する。 */
const isUniqueViolation = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  // DrizzleQueryError は cause に PostgresError を持つ
  const cause = (error as { cause?: { code?: string } }).cause;
  if (cause?.code === "23505") return true;
  // フォールバック: メッセージにも制約名が含まれる場合がある
  return error.message.includes("issue_events_issue_id_version_unique");
};
