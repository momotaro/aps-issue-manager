/**
 * Issue 集約のドメインイベント定義。
 *
 * @remarks
 * イベントソーシングの基盤となる判別共用体。
 * 各イベントは `EventMeta`（共通メタデータ）と `type`（判別子）と `payload`（固有データ）で構成される。
 *
 * イベントは不変であり、一度永続化されたら変更されない。
 * スキーマ変更が必要な場合は新しいイベント型（例: `IssueTitleUpdated_v2`）を追加する。
 */

import type { PhotoId, ProjectId, UserId } from "../valueObjects/brandedId.js";
import type { Comment } from "../valueObjects/comment.js";
import type { IssueCategory } from "../valueObjects/issueCategory.js";
import type { IssueStatus } from "../valueObjects/issueStatus.js";
import type { Photo } from "../valueObjects/photo.js";
import type { Position } from "../valueObjects/position.js";
import type { EventMeta } from "./eventMeta.js";

// ---------------------------------------------------------------------------
// ジェネリック型
// ---------------------------------------------------------------------------

/** ドメインイベントの共通構造。EventMeta + 判別子 type + 固有 payload。 */
type DomainEvent<T extends string, P> = EventMeta & {
  readonly type: T;
  readonly payload: P;
};

// ---------------------------------------------------------------------------
// 個別イベント型
// ---------------------------------------------------------------------------

/** 指摘が新規作成された。集約の最初のイベント（version = 1）。 */
export type IssueCreatedEvent = DomainEvent<
  "IssueCreated",
  {
    readonly projectId: ProjectId;
    readonly title: string;
    readonly description: string;
    readonly status: "open";
    readonly category: IssueCategory;
    readonly position: Position;
    readonly reporterId: UserId;
    readonly assigneeId: UserId | null;
    readonly photos: readonly Photo[];
  }
>;

/** 指摘のタイトルが更新された。 */
export type IssueTitleUpdatedEvent = DomainEvent<
  "IssueTitleUpdated",
  { readonly title: string }
>;

/** 指摘の説明が更新された。 */
export type IssueDescriptionUpdatedEvent = DomainEvent<
  "IssueDescriptionUpdated",
  { readonly description: string }
>;

/** 指摘のステータスが変更された。from/to で前のイベントなしに遷移履歴を確認可能。 */
export type IssueStatusChangedEvent = DomainEvent<
  "IssueStatusChanged",
  { readonly from: IssueStatus; readonly to: IssueStatus }
>;

/** 指摘の種別が変更された。 */
export type IssueCategoryChangedEvent = DomainEvent<
  "IssueCategoryChanged",
  { readonly category: IssueCategory }
>;

/** 指摘の担当者が変更された。null は担当者未割当。 */
export type IssueAssigneeChangedEvent = DomainEvent<
  "IssueAssigneeChanged",
  { readonly assigneeId: UserId | null }
>;

/** 指摘に写真が追加された。 */
export type PhotoAddedEvent = DomainEvent<
  "PhotoAdded",
  { readonly photo: Photo }
>;

/** 指摘から写真が削除された。 */
export type PhotoRemovedEvent = DomainEvent<
  "PhotoRemoved",
  { readonly photoId: PhotoId }
>;

/**
 * 指摘にコメントが追加された。
 *
 * @remarks
 * コメントは immutable（追加のみ）。
 * `comment.createdAt` は `event.occurredAt` と同値で生成すること。
 */
export type CommentAddedEvent = DomainEvent<
  "CommentAdded",
  { readonly comment: Comment }
>;

// ---------------------------------------------------------------------------
// 判別共用体
// ---------------------------------------------------------------------------

/**
 * Issue 集約のすべてのドメインイベントの判別共用体。
 *
 * @remarks
 * `type` フィールドで TypeScript の型絞り込み（narrowing）が可能。
 *
 * ```typescript
 * if (event.type === "IssueStatusChanged") {
 *   // event.payload.from, event.payload.to が型安全にアクセスできる
 * }
 * ```
 */
export type IssueDomainEvent =
  | IssueCreatedEvent
  | IssueTitleUpdatedEvent
  | IssueDescriptionUpdatedEvent
  | IssueStatusChangedEvent
  | IssueCategoryChangedEvent
  | IssueAssigneeChangedEvent
  | PhotoAddedEvent
  | PhotoRemovedEvent
  | CommentAddedEvent;

/** すべてのドメインイベントの `type` フィールドの値。 */
export type IssueDomainEventType = IssueDomainEvent["type"];
