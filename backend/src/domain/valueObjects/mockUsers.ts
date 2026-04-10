/**
 * Mock ユーザー定数。
 *
 * @remarks
 * 業務フローをイメージしやすくするために2名の mock ユーザーを用意する。
 * 将来の認証導入時に実際のユーザーIDに差し替えるだけで対応可能。
 *
 * - 監督会社（ゼネコン）: 指摘の登録、レビュー（承認/差し戻し）を行う
 * - 協力会社（サブコン）: 是正作業を行い、是正完了を報告する
 */

import type { UserId } from "./brandedId.js";
import { parseId } from "./brandedId.js";

/** 監督会社（ゼネコン）の mock ユーザーID。 */
export const MOCK_USER_SUPERVISOR: UserId = parseId<UserId>(
  "00000000-0000-7000-8000-000000000001",
);

/** 協力会社（サブコン）の mock ユーザーID。 */
export const MOCK_USER_CONTRACTOR: UserId = parseId<UserId>(
  "00000000-0000-7000-8000-000000000002",
);
