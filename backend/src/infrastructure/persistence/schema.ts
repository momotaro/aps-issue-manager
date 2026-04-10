import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey(),
    issueId: uuid("issue_id").notNull(),
    body: text("body").notNull(),
    actorId: uuid("actor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("comments_issue_id_idx").on(t.issueId)],
);

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: varchar("role", { length: 20 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  modelUrn: varchar("model_urn", { length: 500 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// issue_events（イベントストア）
// ---------------------------------------------------------------------------

export const issueEvents = pgTable(
  "issue_events",
  {
    id: uuid("id").primaryKey(),
    issueId: uuid("issue_id").notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    actorId: uuid("actor_id").notNull(),
    version: integer("version").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("issue_events_issue_id_version_unique").on(t.issueId, t.version),
  ],
);

// ---------------------------------------------------------------------------
// issues_read（CQRS 読み取りモデル）
// ---------------------------------------------------------------------------

export const issuesRead = pgTable(
  "issues_read",
  {
    id: uuid("id").primaryKey(),
    projectId: uuid("project_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    positionType: varchar("position_type", { length: 20 }).notNull(),
    positionData: jsonb("position_data").notNull(),
    reporterId: uuid("reporter_id").notNull(),
    assigneeId: uuid("assignee_id"),
    photoCount: integer("photo_count").notNull().default(0),
    photos: jsonb("photos").notNull().default([]),
    /**
     * 最新5件のコメントキャッシュ（非正規化）。
     * ソースオブトゥルースは `comments` テーブル。
     * 不整合発生時は `comments` テーブルから再投影して復元すること。
     */
    recentComments: jsonb("recent_comments").notNull().default([]),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("issues_read_project_id_idx").on(t.projectId),
    index("issues_read_status_idx").on(t.status),
    index("issues_read_category_idx").on(t.category),
    index("issues_read_assignee_id_idx").on(t.assigneeId),
  ],
);

// ---------------------------------------------------------------------------
// issue_snapshots（スナップショット）
// ---------------------------------------------------------------------------

export const issueSnapshots = pgTable("issue_snapshots", {
  issueId: uuid("issue_id").primaryKey(),
  state: jsonb("state").notNull(),
  version: integer("version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
