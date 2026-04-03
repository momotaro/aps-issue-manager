import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
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
import { toDomain } from "./eventStoreImpl.js";
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
    const nameMap = await resolveUserNames(db, [
      row.reporterId,
      ...(row.assigneeId ? [row.assigneeId] : []),
    ]);

    return {
      ...toListItem(row, nameMap),
      description: row.description,
      photos: restorePhotoDates(row.photos as Array<Record<string, unknown>>),
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

    if (rows.length === 0) return [];

    // ユーザー名を一括取得（N+1 解消）
    const userIds = [
      ...new Set(
        rows.flatMap((r) => [
          r.reporterId,
          ...(r.assigneeId ? [r.assigneeId] : []),
        ]),
      ),
    ];
    const nameMap = await resolveUserNames(db, userIds);

    return rows.map((row) => toListItem(row, nameMap));
  },

  getEventHistory: async (
    id: IssueId,
  ): Promise<readonly IssueDomainEvent[]> => {
    const rows = await db
      .select()
      .from(issueEvents)
      .where(eq(issueEvents.issueId, id))
      .orderBy(asc(issueEvents.version));

    return rows.map(toDomain);
  },
});

/** userId 配列からユーザー名マップを一括取得する。 */
const resolveUserNames = async (
  db: Db,
  userIds: string[],
): Promise<Map<string, string>> => {
  if (userIds.length === 0) return new Map();

  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, userIds));

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.id, row.name);
  }
  return map;
};

const toListItem = (
  row: ReadRow,
  nameMap: Map<string, string>,
): IssueListItem => ({
  id: parseId(row.id),
  projectId: parseId(row.projectId),
  title: row.title,
  status: row.status as IssueStatus,
  category: row.category as IssueCategory,
  reporterName: nameMap.get(row.reporterId) ?? "Unknown",
  assigneeName: row.assigneeId
    ? (nameMap.get(row.assigneeId) ?? "Unknown")
    : null,
  position: row.positionData as unknown as Position,
  photoCount: row.photoCount,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const restorePhotoDates = (
  photos: Array<Record<string, unknown>>,
): readonly Photo[] =>
  photos.map(
    (p) =>
      ({
        ...p,
        uploadedAt:
          typeof p.uploadedAt === "string"
            ? new Date(p.uploadedAt)
            : p.uploadedAt,
      }) as Photo,
  );
