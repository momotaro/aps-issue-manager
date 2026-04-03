/**
 * EventProjector インターフェース。
 *
 * @remarks
 * イベントソーシングの CQRS 読み取りモデルを更新するためのインターフェース。
 * イベントが EventStore に永続化された後、同一トランザクション内で呼び出され、
 * 非正規化された読み取りテーブル（`issues_read` 等）を更新する。
 *
 * 同期投影（synchronous projection）を採用しているため、
 * 読み取りモデルは常にイベントストアと整合性が保たれる。
 * 将来的に非同期投影（イベントバス）への移行も可能。
 */

import type { IssueDomainEvent } from "../events/issueEvents.js";

/**
 * イベント投影のインターフェース。
 */
export type EventProjector = {
  /**
   * ドメインイベントを読み取りモデルに投影する。
   *
   * @remarks
   * 複数のイベントをまとめて投影できる。
   * `IssueCreated` は新規行を INSERT し、それ以降のイベントは該当行を UPDATE する。
   *
   * @param events - 投影するイベントの配列
   */
  readonly project: (events: readonly IssueDomainEvent[]) => Promise<void>;
};
