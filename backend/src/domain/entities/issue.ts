/**
 * Issue 集約（イベントソーシング）。
 *
 * @remarks
 * 施工現場の指摘を表す集約ルート。状態はドメインイベントの列から復元される。
 *
 * - {@link applyEvent} — 1つのイベントを現在の状態に適用し、新しい状態を返す純粋関数
 * - {@link rehydrate} — イベント列全体から状態を復元する（reduce）
 * - コマンド関数 — ビジネスルールを検証し、新しいイベントを生成する
 *
 * すべての関数は副作用を持たない。状態変更は新しいオブジェクトの返却で表現する。
 */

import { createEventMeta } from "../events/eventMeta.js";
import type {
  CommentAddedEvent,
  IssueAssigneeChangedEvent,
  IssueCategoryChangedEvent,
  IssueCreatedEvent,
  IssueDomainEvent,
  IssueStatusChangedEvent,
  IssueTitleUpdatedEvent,
} from "../events/issueEvents.js";
import type {
  CommentId,
  IssueId,
  ProjectId,
  UserId,
} from "../valueObjects/brandedId.js";
import type { Comment } from "../valueObjects/comment.js";
import {
  COMMENT_MAX_ATTACHMENTS,
  COMMENT_MAX_LENGTH,
  createComment,
} from "../valueObjects/comment.js";
import type { IssueCategory } from "../valueObjects/issueCategory.js";
import type { IssueStatus } from "../valueObjects/issueStatus.js";
import { validateTransition } from "../valueObjects/issueStatus.js";
import type { Photo } from "../valueObjects/photo.js";
import type { Position } from "../valueObjects/position.js";
import type { DomainErrorDetail, Result } from "../valueObjects/result.js";
import { err, ok } from "../valueObjects/result.js";

// ---------------------------------------------------------------------------
// 集約の状態型
// ---------------------------------------------------------------------------

/**
 * Issue 集約の現在の状態。
 *
 * @remarks
 * この型はイベントから {@link applyEvent} で「復元」される読み取り専用のスナップショット。
 * DB に直接保存されるのではなく、イベント列から毎回組み立てる（スナップショットはキャッシュ目的）。
 */
export type Issue = {
  /** 指摘の一意識別子（ULID）。 */
  readonly id: IssueId;
  /** 所属するプロジェクトの ID。 */
  readonly projectId: ProjectId;
  /** 指摘のタイトル。 */
  readonly title: string;
  /** 現在のステータス。 */
  readonly status: IssueStatus;
  /** 指摘の種別。 */
  readonly category: IssueCategory;
  /** 3D上の位置（空間指摘 or 部材指摘）。 */
  readonly position: Position;
  /** 報告者の User ID。 */
  readonly reporterId: UserId;
  /** 担当者の User ID。未割当の場合は `null`。 */
  readonly assigneeId: UserId | null;
  /**
   * コメントの一覧（全件）。
   *
   * @remarks
   * イベントソーシングによりすべてのコメントを保持する。
   * コメント件数が大幅に増加した場合はスナップショット戦略の導入を検討すること。
   */
  readonly comments: readonly Comment[];
  /** 適用済みイベントの最新バージョン番号。 */
  readonly version: number;
  /** 集約の作成日時（`IssueCreated` イベントの `occurredAt`）。 */
  readonly createdAt: Date;
  /** 最終更新日時（最後に適用されたイベントの `occurredAt`）。 */
  readonly updatedAt: Date;
};

// ---------------------------------------------------------------------------
// イベント適用（純粋関数）
// ---------------------------------------------------------------------------

/**
 * 1つのドメインイベントを現在の状態に適用し、新しい状態を返す。
 *
 * @remarks
 * 純粋関数。副作用なし。`IssueCreated` は `null` 状態にのみ適用可能。
 * それ以外のイベントは既存の状態に対して適用する。
 *
 * @param state - 現在の集約状態。`IssueCreated` の場合は `null`
 * @param event - 適用するドメインイベント
 * @returns 新しい集約状態
 */
export const applyEvent = (
  state: Issue | null,
  event: IssueDomainEvent,
): Issue => {
  if (event.type === "IssueCreated") {
    return Object.freeze({
      id: event.issueId,
      projectId: event.payload.projectId,
      title: event.payload.title,
      status: event.payload.status,
      category: event.payload.category,
      position: event.payload.position,
      reporterId: event.payload.reporterId,
      assigneeId: event.payload.assigneeId,
      comments: Object.freeze([]),
      version: event.version,
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
    });
  }

  // IssueCreated 以外のイベントは既存状態が必須
  const current = state as Issue;

  switch (event.type) {
    case "IssueTitleUpdated":
      return Object.freeze({
        ...current,
        title: event.payload.title,
        version: event.version,
        updatedAt: event.occurredAt,
      });

    case "IssueStatusChanged":
      return Object.freeze({
        ...current,
        status: event.payload.to,
        version: event.version,
        updatedAt: event.occurredAt,
      });

    case "IssueCategoryChanged":
      return Object.freeze({
        ...current,
        category: event.payload.category,
        version: event.version,
        updatedAt: event.occurredAt,
      });

    case "IssueAssigneeChanged":
      return Object.freeze({
        ...current,
        assigneeId: event.payload.assigneeId,
        version: event.version,
        updatedAt: event.occurredAt,
      });

    case "CommentAdded":
      return Object.freeze({
        ...current,
        comments: Object.freeze([...current.comments, event.payload.comment]),
        version: event.version,
        updatedAt: event.occurredAt,
      });

    default: {
      const _exhaustive: never = event;
      throw new Error(
        `Unknown issue event type: ${(_exhaustive as IssueDomainEvent).type}`,
      );
    }
  }
};

// ---------------------------------------------------------------------------
// 状態復元
// ---------------------------------------------------------------------------

/**
 * イベント列から Issue 集約の現在状態を復元する。
 *
 * @remarks
 * イベントが空の場合は `null` を返す（集約が存在しない）。
 * イベントは version 順にソートされている前提。
 *
 * @param events - 集約のイベント列（version 昇順）
 * @returns 復元された Issue 状態、またはイベントが空なら `null`
 */
export const rehydrate = (events: readonly IssueDomainEvent[]): Issue | null =>
  events.reduce<Issue | null>(applyEvent, null);

/**
 * スナップショットと差分イベントから Issue 集約の現在状態を復元する。
 *
 * @remarks
 * パフォーマンス最適化用。スナップショット以降のイベントのみ適用する。
 *
 * @param snapshot - 保存済みのスナップショット状態
 * @param events - スナップショット以降のイベント列
 * @returns 復元された Issue 状態
 */
export const rehydrateFromSnapshot = (
  snapshot: Issue,
  events: readonly IssueDomainEvent[],
): Issue => events.reduce<Issue>((s, e) => applyEvent(s, e), snapshot);

// ---------------------------------------------------------------------------
// コマンド関数（ビジネスルール検証 → イベント生成）
// ---------------------------------------------------------------------------

/**
 * 新しい指摘を作成するコマンド。
 *
 * @remarks
 * status は常に `"open"` で開始する。
 * IssueCreatedEvent + CommentAddedEvent（初回コメント）の2イベントを生成する。
 *
 * @param params - 指摘の初期データ
 * @returns 成功時は `[IssueCreatedEvent, CommentAddedEvent]`、失敗時はエラー詳細
 */
export const createIssue = (params: {
  issueId: IssueId;
  projectId: ProjectId;
  title: string;
  category: IssueCategory;
  position: Position;
  reporterId: UserId;
  assigneeId: UserId | null;
  actorId: UserId;
  comment: {
    commentId: CommentId;
    body: string;
    attachments?: readonly Photo[];
  };
}): Result<
  readonly [IssueCreatedEvent, CommentAddedEvent],
  DomainErrorDetail
> => {
  if (params.title.trim().length === 0) {
    return err({ code: "EMPTY_TITLE", message: "Title must not be empty" });
  }

  const body = params.comment.body.trim();
  if (body.length === 0) {
    return err({
      code: "EMPTY_COMMENT",
      message: "Comment body must not be empty",
    });
  }
  if (body.length > COMMENT_MAX_LENGTH) {
    return err({
      code: "BODY_TOO_LONG",
      message: `Comment body must not exceed ${COMMENT_MAX_LENGTH} characters`,
    });
  }
  if (
    params.comment.attachments &&
    params.comment.attachments.length > COMMENT_MAX_ATTACHMENTS
  ) {
    return err({
      code: "TOO_MANY_ATTACHMENTS",
      message: `Attachments must not exceed ${COMMENT_MAX_ATTACHMENTS}`,
    });
  }

  // IssueCreatedEvent (version = 1)
  const createdMeta = createEventMeta(params.issueId, params.actorId, 1);
  const createdEvent: IssueCreatedEvent = Object.freeze({
    ...createdMeta,
    type: "IssueCreated" as const,
    payload: Object.freeze({
      projectId: params.projectId,
      title: params.title.trim(),
      status: "open" as const,
      category: params.category,
      position: params.position,
      reporterId: params.reporterId,
      assigneeId: params.assigneeId,
    }),
  });

  // applyEvent で中間状態を作成し、version を進める
  const intermediateState = applyEvent(null, createdEvent);

  // CommentAddedEvent (version = 2)
  const commentMeta = createEventMeta(
    params.issueId,
    params.actorId,
    intermediateState.version + 1,
  );
  const comment = createComment({
    commentId: params.comment.commentId,
    body,
    actorId: params.actorId,
    attachments: params.comment.attachments,
    createdAt: commentMeta.occurredAt,
  });

  const commentEvent: CommentAddedEvent = Object.freeze({
    ...commentMeta,
    type: "CommentAdded" as const,
    payload: Object.freeze({ comment }),
  });

  return ok(
    Object.freeze([createdEvent, commentEvent]) as readonly [
      IssueCreatedEvent,
      CommentAddedEvent,
    ],
  );
};

/**
 * 指摘のステータスを変更するコマンド。
 *
 * @remarks
 * 状態遷移マシンの検証を行い、許可されない遷移はエラーを返す。
 *
 * @param issue - 現在の Issue 状態
 * @param newStatus - 遷移先のステータス
 * @param actorId - 操作者の User ID
 * @returns 成功時は `IssueStatusChangedEvent`、失敗時はエラー詳細
 */
export const changeStatus = (
  issue: Issue,
  newStatus: IssueStatus,
  actorId: UserId,
): Result<IssueStatusChangedEvent, DomainErrorDetail> => {
  const result = validateTransition(issue.status, newStatus);
  if (!result.ok) return result;

  return ok(
    Object.freeze({
      ...createEventMeta(issue.id, actorId, issue.version + 1),
      type: "IssueStatusChanged" as const,
      payload: Object.freeze({ from: issue.status, to: newStatus }),
    }),
  );
};

/**
 * 指摘のタイトルを更新するコマンド。
 *
 * @param issue - 現在の Issue 状態
 * @param title - 新しいタイトル
 * @param actorId - 操作者の User ID
 * @returns 成功時は `IssueTitleUpdatedEvent`、失敗時はエラー詳細
 */
export const updateTitle = (
  issue: Issue,
  title: string,
  actorId: UserId,
): Result<IssueTitleUpdatedEvent, DomainErrorDetail> => {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return err({ code: "EMPTY_TITLE", message: "Title must not be empty" });
  }
  if (trimmed === issue.title) {
    return err({ code: "NO_CHANGE", message: "Title is unchanged" });
  }

  return ok(
    Object.freeze({
      ...createEventMeta(issue.id, actorId, issue.version + 1),
      type: "IssueTitleUpdated" as const,
      payload: Object.freeze({ title: trimmed }),
    }),
  );
};

/**
 * 指摘の種別を変更するコマンド。
 *
 * @param issue - 現在の Issue 状態
 * @param category - 新しい種別
 * @param actorId - 操作者の User ID
 * @returns 成功時は `IssueCategoryChangedEvent`、失敗時はエラー詳細
 */
export const changeCategory = (
  issue: Issue,
  category: IssueCategory,
  actorId: UserId,
): Result<IssueCategoryChangedEvent, DomainErrorDetail> => {
  if (category === issue.category) {
    return err({ code: "NO_CHANGE", message: "Category is unchanged" });
  }

  return ok(
    Object.freeze({
      ...createEventMeta(issue.id, actorId, issue.version + 1),
      type: "IssueCategoryChanged" as const,
      payload: Object.freeze({ category }),
    }),
  );
};

/**
 * 指摘の担当者を変更するコマンド。
 *
 * @remarks
 * `null` を渡すと担当者を未割当にする。
 *
 * @param issue - 現在の Issue 状態
 * @param assigneeId - 新しい担当者 ID（未割当の場合は `null`）
 * @param actorId - 操作者の User ID
 * @returns 成功時は `IssueAssigneeChangedEvent`、失敗時はエラー詳細
 */
export const changeAssignee = (
  issue: Issue,
  assigneeId: UserId | null,
  actorId: UserId,
): Result<IssueAssigneeChangedEvent, DomainErrorDetail> => {
  if (assigneeId === issue.assigneeId) {
    return err({ code: "NO_CHANGE", message: "Assignee is unchanged" });
  }

  return ok(
    Object.freeze({
      ...createEventMeta(issue.id, actorId, issue.version + 1),
      type: "IssueAssigneeChanged" as const,
      payload: Object.freeze({ assigneeId }),
    }),
  );
};

/**
 * 指摘にコメントを追加するコマンド。
 *
 * @remarks
 * コメントは immutable（追加のみ）。
 * `comment.createdAt` は `event.occurredAt` と同値で設定される。
 *
 * @param issue - 現在の Issue 状態
 * @param commentId - 新しいコメントの ID
 * @param body - コメント本文
 * @param actorId - 操作者の User ID
 * @param attachments - 添付写真（オプション）
 * @returns 成功時は `CommentAddedEvent`、失敗時はエラー詳細
 */
export const addComment = (
  issue: Issue,
  commentId: CommentId,
  body: string,
  actorId: UserId,
  attachments?: readonly Photo[],
): Result<CommentAddedEvent, DomainErrorDetail> => {
  if (body.trim().length === 0) {
    return err({
      code: "EMPTY_COMMENT",
      message: "Comment body must not be empty",
    });
  }

  if (body.trim().length > COMMENT_MAX_LENGTH) {
    return err({
      code: "BODY_TOO_LONG",
      message: `Comment body must not exceed ${COMMENT_MAX_LENGTH} characters`,
    });
  }
  if (attachments && attachments.length > COMMENT_MAX_ATTACHMENTS) {
    return err({
      code: "TOO_MANY_ATTACHMENTS",
      message: `Attachments must not exceed ${COMMENT_MAX_ATTACHMENTS}`,
    });
  }
  if (issue.comments.some((existing) => existing.commentId === commentId)) {
    return err({
      code: "DUPLICATE_COMMENT",
      message: `Comment with the same id already exists: ${commentId}`,
    });
  }

  const meta = createEventMeta(issue.id, actorId, issue.version + 1);
  const comment = createComment({
    commentId,
    body: body.trim(),
    actorId,
    attachments,
    createdAt: meta.occurredAt,
  });

  return ok(
    Object.freeze({
      ...meta,
      type: "CommentAdded" as const,
      payload: Object.freeze({ comment }),
    }),
  );
};
