/**
 * IssueRepository インターフェース（コマンド側）。
 *
 * @remarks
 * イベントソーシングによる Issue 集約の永続化を抽象化する。
 * 内部的には {@link EventStore} を使用してイベントを保存・取得し、
 * {@link rehydrate} でイベント列から集約状態を復元する。
 *
 * スナップショットはパフォーマンス最適化のためのオプション機能。
 * イベント数が増加した集約の復元を高速化する。
 */

import type { Issue } from "../entities/issue.js";
import type { IssueDomainEvent } from "../events/issueEvents.js";
import type { IssueId } from "../valueObjects/brandedId.js";

/**
 * Issue 集約のスナップショット。
 *
 * @remarks
 * 復元済みの集約状態と、その時点の version を保持する。
 * version 以降のイベントのみを追加適用することで、全イベント再生を回避できる。
 */
export type IssueSnapshot = {
  /** スナップショット時点の集約状態。 */
  readonly state: Issue;
  /** スナップショット時点の version。 */
  readonly version: number;
};

/**
 * IssueRepository のインターフェース。
 */
export type IssueRepository = {
  /**
   * Issue 集約を読み込む。
   *
   * @remarks
   * スナップショットが存在する場合はスナップショット + 差分イベントで復元する。
   * 存在しない場合は全イベントを再生して復元する。
   *
   * @param id - Issue 集約の ID
   * @returns 復元された Issue 状態。存在しない場合は `null`
   */
  readonly load: (id: IssueId) => Promise<Issue | null>;

  /**
   * 新しいイベントを永続化する。
   *
   * @param id - Issue 集約の ID
   * @param events - 永続化するイベントの配列
   * @param expectedVersion - 楽観的同時実行制御のための期待 version
   * @throws {@link ConcurrencyError} version が競合した場合
   */
  readonly save: (
    id: IssueId,
    events: readonly IssueDomainEvent[],
    expectedVersion: number,
  ) => Promise<void>;

  /**
   * スナップショットを保存する。
   *
   * @remarks
   * パフォーマンス最適化用。イベント数が閾値を超えた集約に対して使用する。
   *
   * @param snapshot - 保存するスナップショット
   */
  readonly saveSnapshot: (snapshot: IssueSnapshot) => Promise<void>;

  /**
   * スナップショットを取得する。
   *
   * @param id - Issue 集約の ID
   * @returns スナップショット。存在しない場合は `null`
   */
  readonly getSnapshot: (id: IssueId) => Promise<IssueSnapshot | null>;
};
