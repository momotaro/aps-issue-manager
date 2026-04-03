import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import type {
  IssueDetail,
  IssueFilters,
  IssueListItem,
  IssueQueryService,
} from "../../domain/repositories/issueQueryService.js";
import type { IssueId } from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import type { IssueCategory } from "../../domain/valueObjects/issueCategory.js";
import type { IssueStatus } from "../../domain/valueObjects/issueStatus.js";
import type { Photo } from "../../domain/valueObjects/photo.js";
import type { Position } from "../../domain/valueObjects/position.js";
import { issueEvents, issuesRead, users } from "./schema.js";
import type { Db } from "./types.js";

type ReadRow = typeof issuesRead.$inferSelect;

/** IssueQueryService を生成する高階関数。 */
export const createIssueQueryService = (db: Db): IssueQueryService => ({
  findById: async (id: IssueId): Promise<IssueDetail | null> => {
    const rows = await db
      .select()
      .from(issuesRead)
      .where(eq(issuesRead.id, id));

    if (rows.length === 0) return null;

    const row = rows[0];
    const reporterName = await resolveUserName(db, row.reporterId);
    const assigneeName = row.assigneeId
      ? await resolveUserName(db, row.assigneeId)
      : null;

    return {
      ...toListItem(row, reporterName, assigneeName),
      description: row.description,
      photos: row.photos as unknown as readonly Photo[],
    };
  },

  findAll: async (
    filters?: IssueFilters,
  ): Promise<readonly IssueListItem[]> => {
    const conditions: SQL[] = [];

    if (filters?.projectId) {
      conditions.push(eq(issuesRead.projectId, filters.projectId));
    }
    if (filters?.status) {
      conditions.push(eq(issuesRead.status, filters.status));
    }
    if (filters?.category) {
      conditions.push(eq(issuesRead.category, filters.category));
    }
    if (filters?.assigneeId) {
      conditions.push(eq(issuesRead.assigneeId, filters.assigneeId));
    }

    const rows = await db
      .select()
      .from(issuesRead)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(issuesRead.updatedAt));

    const items: IssueListItem[] = [];
    for (const row of rows) {
      const reporterName = await resolveUserName(db, row.reporterId);
      const assigneeName = row.assigneeId
        ? await resolveUserName(db, row.assigneeId)
        : null;
      items.push(toListItem(row, reporterName, assigneeName));
    }
    return items;
  },

  getEventHistory: async (
    id: IssueId,
  ): Promise<readonly IssueDomainEvent[]> => {
    const rows = await db
      .select()
      .from(issueEvents)
      .where(eq(issueEvents.issueId, id))
      .orderBy(asc(issueEvents.version));

    return rows.map(
      (row) =>
        ({
          id: parseId(row.id),
          issueId: parseId(row.issueId),
          occurredAt: row.occurredAt,
          actorId: parseId(row.actorId),
          version: row.version,
          type: row.type,
          payload: row.payload,
        }) as IssueDomainEvent,
    );
  },
});

const resolveUserName = async (db: Db, userId: string): Promise<string> => {
  const rows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId));
  return rows.length > 0 ? rows[0].name : "Unknown";
};

const toListItem = (
  row: ReadRow,
  reporterName: string,
  assigneeName: string | null,
): IssueListItem => ({
  id: parseId(row.id),
  projectId: parseId(row.projectId),
  title: row.title,
  status: row.status as IssueStatus,
  category: row.category as IssueCategory,
  reporterName,
  assigneeName,
  position: row.positionData as unknown as Position,
  photoCount: row.photoCount,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
