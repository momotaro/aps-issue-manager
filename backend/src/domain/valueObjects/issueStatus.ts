/**
 * 指摘ステータスの値オブジェクト。
 *
 * @remarks
 * 状態遷移マシンを隣接マップで表現し、許可された遷移のみを受け付ける。
 *
 * ```
 * open → in_progress → in_review → done
 *                        ↓ (差し戻し)
 *                    in_progress
 * ```
 */

import type { DomainErrorDetail, Result } from "./result.js";
import { err, ok } from "./result.js";

/** 指摘のステータスを表す定数タプル。 */
export const ISSUE_STATUSES = [
  "open",
  "in_progress",
  "in_review",
  "done",
] as const;

/** 指摘のステータス。 */
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/**
 * 許可されたステータス遷移の隣接マップ。
 *
 * @remarks
 * - `open` → `in_progress`: 是正作業を開始
 * - `in_progress` → `in_review`: 是正完了、管理者確認待ち
 * - `in_review` → `done`: 管理者が承認
 * - `in_review` → `in_progress`: 管理者が差し戻し
 * - `done` → （遷移不可）: 確定済み
 */
const VALID_TRANSITIONS: Record<IssueStatus, readonly IssueStatus[]> = {
  open: ["in_progress"],
  in_progress: ["in_review"],
  in_review: ["done", "in_progress"],
  done: [],
} as const;

/**
 * 指定された遷移が許可されているかを判定する。
 *
 * @param from - 現在のステータス
 * @param to - 遷移先のステータス
 * @returns 遷移が許可されていれば `true`
 */
export const canTransition = (from: IssueStatus, to: IssueStatus): boolean =>
  VALID_TRANSITIONS[from].includes(to);

/**
 * ステータス遷移を検証し、Result 型で結果を返す。
 *
 * @param from - 現在のステータス
 * @param to - 遷移先のステータス
 * @returns 成功時は遷移先ステータス、失敗時はエラー詳細
 */
export const validateTransition = (
  from: IssueStatus,
  to: IssueStatus,
): Result<IssueStatus, DomainErrorDetail> => {
  if (canTransition(from, to)) {
    return ok(to);
  }
  return err({
    code: "INVALID_TRANSITION",
    message: `Cannot transition from "${from}" to "${to}"`,
  });
};

/**
 * 値が有効な IssueStatus かどうかを判定する型ガード。
 *
 * @param value - 検証する値
 */
export const isIssueStatus = (value: unknown): value is IssueStatus =>
  typeof value === "string" && ISSUE_STATUSES.includes(value as IssueStatus);
