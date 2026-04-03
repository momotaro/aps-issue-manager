/**
 * ドメインイベントの共通メタデータ。
 *
 * @remarks
 * すべての Issue ドメインイベントが持つ共通フィールドを定義する。
 * `version` は集約ごとの連番で、楽観的同時実行制御とスナップショット差分取得に使用する。
 * 時刻情報は `occurredAt` で別途保持するため、`version` に時刻の意味は持たせない。
 */

import {
  type EventId,
  generateId,
  type IssueId,
  type UserId,
} from "../valueObjects/brandedId.js";

/**
 * ドメインイベントの共通メタデータ。
 *
 * @remarks
 * イベントの識別・順序・追跡に必要な情報を持つ。
 */
export type EventMeta = {
  /** イベントの一意識別子（ULID）。 */
  readonly id: EventId;
  /** 対象となる Issue 集約の ID。 */
  readonly issueId: IssueId;
  /** イベントの発生日時。監査証跡や UI 表示に使用する。 */
  readonly occurredAt: Date;
  /** イベントを発生させた操作者の ID。 */
  readonly actorId: UserId;
  /**
   * 集約内の連番バージョン。
   *
   * @remarks
   * - `IssueCreated` イベントは常に version = 1
   * - 以降のイベントは前回の version + 1
   * - EventStore への append 時に expectedVersion との一致を検証する
   */
  readonly version: number;
};

/**
 * EventMeta を生成する。
 *
 * @param issueId - 対象の Issue 集約 ID
 * @param actorId - 操作者の User ID
 * @param version - 集約内の連番バージョン
 * @returns 凍結された EventMeta オブジェクト
 */
export const createEventMeta = (
  issueId: IssueId,
  actorId: UserId,
  version: number,
): EventMeta =>
  Object.freeze({
    id: generateId<EventId>(),
    issueId,
    occurredAt: new Date(),
    actorId,
    version,
  });
