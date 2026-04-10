import { and, asc, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import type {
  IssueDetail,
  IssueFilters,
  IssueListItem,
  IssueQueryService,
  QueryOptions,
} from "../../domain/repositories/issueQueryService.js";
import type { IssueId } from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import type { Comment } from "../../domain/valueObjects/comment.js";
import type { IssueCategory } from "../../domain/valueObjects/issueCategory.js";
import type { IssueStatus } from "../../domain/valueObjects/issueStatus.js";
import {
  confirmedBlobPath,
  type Photo,
} from "../../domain/valueObjects/photo.js";
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
      recentComments: restoreCommentDates(
        row.recentComments as Array<Record<string, unknown>>,
      ),
    };
  },

  findAll: async (
    filters?: IssueFilters,
    options?: QueryOptions,
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
    if (filters?.keyword) {
      const escaped = filters.keyword.replace(/[\\%_]/g, "\\$&");
      const pattern = `%${escaped}%`;
      const keywordCondition = or(
        ilike(issuesRead.title, pattern),
        ilike(issuesRead.description, pattern),
      );
      if (keywordCondition) conditions.push(keywordCondition);
    }

    const sortColumn =
      options?.sortBy === "createdAt"
        ? issuesRead.createdAt
        : issuesRead.updatedAt;
    const sortDirection = options?.sortOrder === "asc" ? asc : desc;

    const rows = await db
      .select()
      .from(issuesRead)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortDirection(sortColumn));

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
  reporterName: nameMap.get(row.reporterId) ?? null,
  assigneeName: row.assigneeId ? (nameMap.get(row.assigneeId) ?? null) : null,
  position: row.positionData as unknown as Position,
  photoCount: row.photoCount,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** 旧データ互換のため、legacy な pending/ パスを confirmed/ パスへ正規化する。 */
const normalizeStoragePath = (photo: Record<string, unknown>): string => {
  const path = photo.storagePath;
  if (typeof path !== "string") return String(path ?? "");
  if (!path.startsWith("pending/")) return path;
  // pending/{issueId}/{photoId}.{ext} → confirmed/{issueId}/{phase}/{photoId}.{ext}
  const parts = path.split("/"); // ["pending", issueId, "photoId.ext"]
  if (parts.length < 3) return path;
  const issueId = parts[1];
  const fileName = parts[2]; // "photoId.ext"
  if (!issueId || !fileName) return path;
  const phase = photo.phase;
  if (phase !== "before" && phase !== "after") return path;
  const photoId = fileName.split(".")[0];
  const ext = fileName.split(".").pop() ?? "";
  return confirmedBlobPath(issueId, phase, photoId, ext);
};

export const restoreCommentDates = (
  comments: Array<Record<string, unknown>>,
): readonly Comment[] =>
  (comments ?? []).map(
    (c) =>
      ({
        ...c,
        createdAt:
          typeof c.createdAt === "string" ? new Date(c.createdAt) : c.createdAt,
      }) as Comment,
  );

const restorePhotoDates = (
  photos: Array<Record<string, unknown>>,
): readonly Photo[] =>
  photos.map(
    (p) =>
      ({
        ...p,
        storagePath: normalizeStoragePath(p),
        uploadedAt:
          typeof p.uploadedAt === "string"
            ? new Date(p.uploadedAt)
            : p.uploadedAt,
      }) as Photo,
  );
