/**
 * フロントエンドの Mock ユーザー定数。
 *
 * @remarks
 * 業務フローをイメージしやすくするために 2 名の mock ユーザーを定義する。
 * backend `backend/src/domain/valueObjects/mockUsers.ts` の UUID と base62 で対応する。
 *
 * - `supervisor` — 監督会社（ゼネコン）: 指摘の登録、レビュー（承認/差し戻し）
 * - `contractor` — 協力会社（サブコン）: 是正作業、是正完了の報告
 *
 * TODO(auth): 認証導入時は backend のセッションから取得する形に差し替える。
 * この時点でクライアントから `actorId` を送信する箇所（`issue-repository.ts`）も廃止すること。
 */

/** ユーザーが所属する会社の種別。 */
export type UserCompany = "supervisor" | "contractor";

/** Mock ユーザーのデータ型。 */
export type MockUser = {
  /** base62 エンコードされた UUID（backend の UserId と同値）。 */
  readonly id: string;
  /** 表示名。 */
  readonly name: string;
  /** 所属会社。 */
  readonly company: UserCompany;
  /** アバターに使う色（Tailwind hex）。 */
  readonly color: string;
};

/** 監督会社（ゼネコン）の mock ユーザー。 */
export const MOCK_USER_SUPERVISOR: MockUser = {
  id: "000000002dwHTRTFRxWLTN",
  name: "田中（監督会社）",
  company: "supervisor",
  color: "#3B82F6",
};

/** 協力会社（サブコン）の mock ユーザー。 */
export const MOCK_USER_CONTRACTOR: MockUser = {
  id: "000000002dwHTRTFRxWLTO",
  name: "佐藤（協力会社）",
  company: "contractor",
  color: "#F59E0B",
};

/** すべての mock ユーザーの配列。UserSwitcher の表示順と一致する。 */
export const MOCK_USERS: readonly MockUser[] = [
  MOCK_USER_SUPERVISOR,
  MOCK_USER_CONTRACTOR,
];

/** ID から mock ユーザーを引く。 */
export const findMockUserById = (id: string): MockUser | undefined =>
  MOCK_USERS.find((u) => u.id === id);
