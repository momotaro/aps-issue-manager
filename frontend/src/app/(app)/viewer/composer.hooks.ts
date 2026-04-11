"use client";

/**
 * Composer の ActionBar ボタン出し分けロジック（純粋関数）。
 *
 * @remarks
 * mode × status × user.company のマトリクスから、表示すべきボタン集合を算出する。
 * UI 依存を持たないため単体テストしやすい。
 *
 * **重要**: このロジックはあくまで UX のためであり、セキュリティ境界ではない。
 * クライアントを迂回して backend の endpoint を直接叩けば、ロールガードなしに操作される。
 * 認可ガードは別 Issue で backend middleware に導入する（future-considerations.md 参照）。
 */

import type { UserCompany } from "@/lib/mock-users";
import type { IssueStatus } from "@/types/issue";

export type ComposerMode = "add" | "edit";

/** Composer の ActionBar に表示するボタン種別。 */
export type ComposerAction =
  /** Add モードで新規 Issue を作成する。 */
  | "submit"
  /** コメントのみ追加（ステータス遷移なし、`addComment`）。 */
  | "comment"
  /** 協力会社が作業開始を宣言する（`open → in_progress`、`correctIssue` を流用）。 */
  | "start"
  /** 是正完了（`in_progress → in_review`、`correctIssue`）。 */
  | "correct"
  /** レビュー承認（`in_review → done`、`reviewIssue`）。 */
  | "approve"
  /** レビュー差し戻し（`in_review → in_progress`、`reviewIssue`）。 */
  | "reject";

export type ComposerActionBarState = {
  /** 入力 UI を丸ごと非表示にする（done 状態など読み取り専用時）。 */
  hidden: boolean;
  /** 写真添付ボタンを表示するか。 */
  canAttachPhoto: boolean;
  /** ActionBar に表示するボタン集合（左から順）。 */
  actions: readonly ComposerAction[];
  /** 待機状態時のヒント文（表示される場合は textarea 上部に出す）。 */
  waitingHint: string | null;
};

/**
 * Composer の ActionBar 状態を計算する。
 *
 * @remarks
 * `mode × status × company` のマトリクスから、表示する UI を決定する。
 *
 * - `done`: 入力 UI 自体を非表示（`hidden: true`）
 * - 監督会社 + `open`: 協力会社の作業開始待ち（コメントのみ可 + ヒント）
 * - 協力会社 + `open`: 作業開始 + コメント（`start` アクション）
 * - 監督会社 + `in_progress`: 協力会社の是正対応待ち（コメントのみ可 + ヒント）
 * - 協力会社 + `in_progress`: 是正完了 + コメント（`correct` アクション）
 * - 監督会社 + `in_review`: 承認 / 差し戻し（写真添付不可）
 * - 協力会社 + `in_review`: 監督会社のレビュー待ち（コメントのみ可 + ヒント）
 *
 * @example
 * ```ts
 * getComposerActionBarState({ mode: 'edit', status: 'in_progress', company: 'contractor' })
 * // → { hidden: false, canAttachPhoto: true, actions: ['comment', 'correct'], waitingHint: null }
 * ```
 */
export function getComposerActionBarState(params: {
  mode: ComposerMode;
  status: IssueStatus | null;
  company: UserCompany;
}): ComposerActionBarState {
  const { mode, status, company } = params;

  if (mode === "add") {
    return {
      hidden: false,
      canAttachPhoto: true,
      actions: ["submit"],
      waitingHint: null,
    };
  }

  // edit モード
  switch (status) {
    case "done":
      // 完了済み: 入力 UI 非表示（読み取り専用）
      return {
        hidden: true,
        canAttachPhoto: false,
        actions: [],
        waitingHint: null,
      };

    case "in_review":
      if (company === "supervisor") {
        // 監督会社が in_review をレビューする → 差し戻し / 承認（写真添付不可）
        return {
          hidden: false,
          canAttachPhoto: false,
          actions: ["reject", "approve"],
          waitingHint: null,
        };
      }
      // 協力会社は in_review 中はレビュー待ち（コメントのみ可）
      return {
        hidden: false,
        canAttachPhoto: true,
        actions: ["comment"],
        waitingHint: "監督会社のレビュー待ちです",
      };

    case "in_progress":
      if (company === "contractor") {
        // 協力会社: 是正完了アクション + コメント
        return {
          hidden: false,
          canAttachPhoto: true,
          actions: ["comment", "correct"],
          waitingHint: null,
        };
      }
      // 監督会社: 是正対応待ち（コメントのみ可）
      return {
        hidden: false,
        canAttachPhoto: true,
        actions: ["comment"],
        waitingHint: "協力会社の是正対応待ちです",
      };

    case "open":
      if (company === "contractor") {
        // 協力会社: 作業開始アクション + コメント
        return {
          hidden: false,
          canAttachPhoto: true,
          actions: ["comment", "start"],
          waitingHint: null,
        };
      }
      // 監督会社: 協力会社の作業開始待ち（コメントのみ可）
      return {
        hidden: false,
        canAttachPhoto: true,
        actions: ["comment"],
        waitingHint: "協力会社の作業開始待ちです",
      };

    case null:
      // 未ロード: コメントのみ
      return {
        hidden: false,
        canAttachPhoto: true,
        actions: ["comment"],
        waitingHint: null,
      };

    default:
      return {
        hidden: false,
        canAttachPhoto: true,
        actions: ["comment"],
        waitingHint: null,
      };
  }
}
