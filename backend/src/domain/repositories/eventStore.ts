/**
 * EventStore インターフェース。
 *
 * @remarks
 * イベントソーシングの永続化基盤。Issue 集約のドメインイベントを
 * 追記専用（append-only）で保存し、集約 ID ごとに取得する。
 *
 * 楽観的同時実行制御を `expectedVersion` パラメータで実現する。
 * 別のリクエストが先にイベントを追記していた場合、
 * {@link ConcurrencyError} がスローされる。
 *
 * このインターフェースはドメイン層に定義し、実装は `infrastructure/persistence/` に置く。
 */

import type { IssueDomainEvent } from "../events/issueEvents.js";
import type { IssueId } from "../valueObjects/brandedId.js";

/**
 * イベントストアのインターフェース。
 */
export type EventStore = {
  /**
   * イベントを集約に追記する。
   *
   * @remarks
   * `expectedVersion` は呼び出し側が最後に確認した集約の version。
   * 新規集約の場合は `0` を指定する。
   * DB 側の実際の最新 version と一致しない場合は `ConcurrencyError` をスローする。
   *
   * @param aggregateId - 対象の Issue 集約 ID
   * @param events - 追記するイベントの配列
   * @param expectedVersion - 呼び出し側が期待する現在の version
   * @throws {@link ConcurrencyError} version が競合した場合
   */
  readonly append: (
    aggregateId: IssueId,
    events: readonly IssueDomainEvent[],
    expectedVersion: number,
  ) => Promise<void>;

  /**
   * 集約のイベントを version 昇順で取得する。
   *
   * @remarks
   * `afterVersion` を指定すると、そのバージョンより後のイベントのみを返す。
   * スナップショットからの差分復元に使用する。
   *
   * @param aggregateId - 対象の Issue 集約 ID
   * @param afterVersion - この version より後のイベントのみ取得（省略時は全件）
   * @returns version 昇順のイベント配列
   */
  readonly getEvents: (
    aggregateId: IssueId,
    afterVersion?: number,
  ) => Promise<readonly IssueDomainEvent[]>;
};
