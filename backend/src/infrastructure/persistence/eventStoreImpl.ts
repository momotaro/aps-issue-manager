import { and, asc, desc, eq, gt } from "drizzle-orm";
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

export type EventRow = typeof issueEvents.$inferSelect;

const toRow = (event: IssueDomainEvent) => ({
  id: event.id,
  issueId: event.issueId,
  type: event.type,
  payload: event.payload as Record<string, unknown>,
  actorId: event.actorId,
  version: event.version,
  occurredAt: event.occurredAt,
});

export const toDomain = (row: EventRow): IssueDomainEvent => {
  const meta: EventMeta = {
    id: parseId(row.id),
    issueId: parseId(row.issueId),
    occurredAt: row.occurredAt,
    actorId: parseId(row.actorId),
    version: row.version,
  };

  const payload = restorePayloadDates(
    row.type,
    row.payload as Record<string, unknown>,
  );

  return {
    ...meta,
    type: row.type as IssueDomainEventType,
    payload,
  } as IssueDomainEvent;
};

/** JSONB payload 内の Date フィールドを文字列から Date に復元する。 */
export const restorePayloadDates = (
  type: string,
  payload: Record<string, unknown>,
): Record<string, unknown> => {
  switch (type) {
    case "CommentAdded": {
      const comment = payload.comment as Record<string, unknown> | undefined;
      if (comment) {
        return { ...payload, comment: restoreCommentDate(comment) };
      }
      return payload;
    }
    default:
      return payload;
  }
};

const restoreCommentDate = (
  comment: Record<string, unknown>,
): Record<string, unknown> => {
  const restored: Record<string, unknown> = {
    ...comment,
    createdAt:
      typeof comment.createdAt === "string"
        ? new Date(comment.createdAt)
        : comment.createdAt,
  };

  // attachments 内の Photo.uploadedAt を復元（undefined/null も空配列に正規化）
  const attachments = (comment.attachments ?? []) as Array<
    Record<string, unknown>
  >;
  restored.attachments = attachments.map(restorePhotoDate);

  return restored;
};

const restorePhotoDate = (
  photo: Record<string, unknown>,
): Record<string, unknown> => ({
  ...photo,
  uploadedAt:
    typeof photo.uploadedAt === "string"
      ? new Date(photo.uploadedAt)
      : photo.uploadedAt,
});

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

        // 楽観的同時実行制御: 最新 version を取得して expectedVersion と照合
        const latestRows = await executor
          .select({ version: issueEvents.version })
          .from(issueEvents)
          .where(eq(issueEvents.issueId, aggregateId))
          .orderBy(desc(issueEvents.version))
          .limit(1);

        const actualVersion = latestRows.length > 0 ? latestRows[0].version : 0;
        if (actualVersion !== expectedVersion) {
          throw new ConcurrencyError(
            aggregateId,
            expectedVersion,
            actualVersion,
          );
        }

        try {
          await executor.insert(issueEvents).values(events.map(toRow));
        } catch (error: unknown) {
          // UNIQUE(issue_id, version) 違反のみ ConcurrencyError に変換
          if (isVersionConflict(error)) {
            // トランザクション abort 後の再 SELECT は失敗する可能性があるため、
            // expectedVersion + 挿入済みイベント数から推定する
            const lastEventVersion = events[events.length - 1].version;
            throw new ConcurrencyError(
              aggregateId,
              expectedVersion,
              lastEventVersion,
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

const toRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const readString = (
  source: Record<string, unknown> | null,
  key: string,
): string | undefined => {
  const value = source?.[key];
  return typeof value === "string" ? value : undefined;
};

/** issue_events の UNIQUE(issue_id, version) 制約違反かどうかを判定する。 */
export const isVersionConflict = (error: unknown): boolean => {
  const topLevel = toRecord(error);
  const cause = toRecord(topLevel?.cause);

  const code = readString(cause, "code") ?? readString(topLevel, "code");
  if (code !== "23505") return false;

  const constraintName =
    readString(cause, "constraint_name") ??
    readString(cause, "constraint") ??
    readString(cause, "constraintName") ??
    readString(topLevel, "constraint_name") ??
    readString(topLevel, "constraint") ??
    readString(topLevel, "constraintName");

  // constraint 名で判別（PK 衝突等との誤分類を防止）
  if (constraintName === "issue_events_issue_id_version_unique") return true;

  const detail =
    readString(cause, "detail") ?? readString(topLevel, "detail") ?? "";

  // フォールバック: detail メッセージで判別
  return detail.includes("issue_id, version");
};
