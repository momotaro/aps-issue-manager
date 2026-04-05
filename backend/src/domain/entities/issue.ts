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
  IssueAssigneeChangedEvent,
  IssueCategoryChangedEvent,
  IssueCreatedEvent,
  IssueDescriptionUpdatedEvent,
  IssueDomainEvent,
  IssueStatusChangedEvent,
  IssueTitleUpdatedEvent,
  PhotoAddedEvent,
  PhotoRemovedEvent,
} from "../events/issueEvents.js";
import type {
  IssueId,
  PhotoId,
  ProjectId,
  UserId,
} from "../valueObjects/brandedId.js";
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
  /** 指摘の詳細説明。 */
  readonly description: string;
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
  /** 添付写真の一覧。 */
  readonly photos: readonly Photo[];
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
      description: event.payload.description,
      status: event.payload.status,
      category: event.payload.category,
      position: event.payload.position,
      reporterId: event.payload.reporterId,
      assigneeId: event.payload.assigneeId,
      photos: Object.freeze([...event.payload.photos]),
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

    case "IssueDescriptionUpdated":
      return Object.freeze({
        ...current,
        description: event.payload.description,
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

    case "PhotoAdded":
      return Object.freeze({
        ...current,
        photos: Object.freeze([...current.photos, event.payload.photo]),
        version: event.version,
        updatedAt: event.occurredAt,
      });

    case "PhotoRemoved":
      return Object.freeze({
        ...current,
        photos: Object.freeze(
          current.photos.filter((p) => p.id !== event.payload.photoId),
        ),
        version: event.version,
        updatedAt: event.occurredAt,
      });
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
 * タイトルが空の場合はエラーを返す。
 *
 * @param params - 指摘の初期データ
 * @returns 成功時は `IssueCreatedEvent`、失敗時はエラー詳細
 */
export const createIssue = (params: {
  issueId: IssueId;
  projectId: ProjectId;
  title: string;
  description: string;
  category: IssueCategory;
  position: Position;
  reporterId: UserId;
  assigneeId: UserId | null;
  photos: readonly Photo[];
  actorId: UserId;
}): Result<IssueCreatedEvent, DomainErrorDetail> => {
  if (params.title.trim().length === 0) {
    return err({ code: "EMPTY_TITLE", message: "Title must not be empty" });
  }

  const meta = createEventMeta(params.issueId, params.actorId, 1);

  return ok(
    Object.freeze({
      ...meta,
      type: "IssueCreated" as const,
      payload: Object.freeze({
        projectId: params.projectId,
        title: params.title.trim(),
        description: params.description,
        status: "open" as const,
        category: params.category,
        position: params.position,
        reporterId: params.reporterId,
        assigneeId: params.assigneeId,
        photos: Object.freeze([...params.photos]),
      }),
    }),
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
 * 指摘の説明を更新するコマンド。
 *
 * @param issue - 現在の Issue 状態
 * @param description - 新しい説明
 * @param actorId - 操作者の User ID
 * @returns 成功時は `IssueDescriptionUpdatedEvent`、失敗時はエラー詳細
 */
export const updateDescription = (
  issue: Issue,
  description: string,
  actorId: UserId,
): Result<IssueDescriptionUpdatedEvent, DomainErrorDetail> => {
  if (description === issue.description) {
    return err({ code: "NO_CHANGE", message: "Description is unchanged" });
  }

  return ok(
    Object.freeze({
      ...createEventMeta(issue.id, actorId, issue.version + 1),
      type: "IssueDescriptionUpdated" as const,
      payload: Object.freeze({ description }),
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
 * 指摘に写真を追加するコマンド。
 *
 * @param issue - 現在の Issue 状態
 * @param photo - 追加する写真
 * @param actorId - 操作者の User ID
 * @returns 成功時は `PhotoAddedEvent`、失敗時はエラー詳細
 */
export const addPhoto = (
  issue: Issue,
  photo: Photo,
  actorId: UserId,
): Result<PhotoAddedEvent, DomainErrorDetail> => {
  const duplicate = issue.photos.some((p) => p.id === photo.id);
  if (duplicate) {
    return err({
      code: "DUPLICATE_PHOTO",
      message: `Photo ${photo.id} already exists`,
    });
  }

  return ok(
    Object.freeze({
      ...createEventMeta(issue.id, actorId, issue.version + 1),
      type: "PhotoAdded" as const,
      payload: Object.freeze({ photo }),
    }),
  );
};

/**
 * 指摘から写真を削除するコマンド。
 *
 * @param issue - 現在の Issue 状態
 * @param photoId - 削除する写真の ID
 * @param actorId - 操作者の User ID
 * @returns 成功時は `PhotoRemovedEvent`、失敗時はエラー詳細
 */
export const removePhoto = (
  issue: Issue,
  photoId: PhotoId,
  actorId: UserId,
): Result<PhotoRemovedEvent, DomainErrorDetail> => {
  const exists = issue.photos.some((p) => p.id === photoId);
  if (!exists) {
    return err({
      code: "PHOTO_NOT_FOUND",
      message: `Photo ${photoId} not found`,
    });
  }

  return ok(
    Object.freeze({
      ...createEventMeta(issue.id, actorId, issue.version + 1),
      type: "PhotoRemoved" as const,
      payload: Object.freeze({ photoId }),
    }),
  );
};
