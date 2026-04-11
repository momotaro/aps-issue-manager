/**
 * Mock ユーザー定数。
 *
 * @remarks
 * 業務フローをイメージしやすくするために 2 名の mock ユーザーを用意する。
 * 将来の認証導入時に、ここを実際のユーザー情報取得に差し替える。
 *
 * - 監督会社（ゼネコン）: 指摘の登録、レビュー（承認/差し戻し）を行う
 * - 協力会社（サブコン）: 是正作業を行い、是正完了を報告する
 *
 * DB への投入は {@link ./../../infrastructure/persistence/seedMockUsers.ts} のシード関数で行う。
 */

import type { UserRole } from "../entities/user.js";
import type { UserId } from "./brandedId.js";
import { parseId } from "./brandedId.js";

/** 監督会社（ゼネコン）の mock ユーザーID。 */
export const MOCK_USER_SUPERVISOR_ID: UserId = parseId<UserId>(
  "00000000-0000-7000-8000-000000000001",
);

/** 協力会社（サブコン）の mock ユーザーID。 */
export const MOCK_USER_CONTRACTOR_ID: UserId = parseId<UserId>(
  "00000000-0000-7000-8000-000000000002",
);

/** Mock ユーザーのメタデータ型。 */
export type MockUserData = {
  readonly id: UserId;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
};

/** 監督会社の mock ユーザー。 */
export const MOCK_USER_SUPERVISOR_DATA: MockUserData = {
  id: MOCK_USER_SUPERVISOR_ID,
  name: "田中（監督会社）",
  email: "supervisor@example.com",
  role: "admin",
};

/** 協力会社の mock ユーザー。 */
export const MOCK_USER_CONTRACTOR_DATA: MockUserData = {
  id: MOCK_USER_CONTRACTOR_ID,
  name: "佐藤（協力会社）",
  email: "contractor@example.com",
  role: "member",
};

/** すべての mock ユーザーの配列。 */
export const MOCK_USERS: readonly MockUserData[] = [
  MOCK_USER_SUPERVISOR_DATA,
  MOCK_USER_CONTRACTOR_DATA,
];
