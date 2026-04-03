/**
 * User エンティティ（単純 CRUD）。
 *
 * @remarks
 * マルチユーザー対応のためのユーザー情報を管理する。
 * イベントソーシングは使用せず、シンプルな CRUD で永続化する。
 *
 * ロールは施工現場の役割に対応する:
 * - `admin` — 現場監督（佐藤さん）。指摘の承認・差し戻し権限を持つ
 * - `manager` — 安全担当（中村さん）。指摘の登録・管理を行う
 * - `member` — 協力会社（山本さん）。是正作業を担当する
 */

import { DomainError } from "../services/errors.js";
import { generateId, type UserId } from "../valueObjects/brandedId.js";

// ---------------------------------------------------------------------------
// ロール定義
// ---------------------------------------------------------------------------

/** ユーザーロールの定数タプル。 */
export const USER_ROLES = ["admin", "manager", "member"] as const;

/** ユーザーのロール。 */
export type UserRole = (typeof USER_ROLES)[number];

/**
 * 値が有効な UserRole かどうかを判定する型ガード。
 *
 * @param value - 検証する値
 */
export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && USER_ROLES.includes(value as UserRole);

// ---------------------------------------------------------------------------
// エンティティ型
// ---------------------------------------------------------------------------

/**
 * ユーザーエンティティ。
 *
 * @remarks
 * 認証情報（パスワード等）はこのエンティティに含めない。
 * 認証は将来 JWT ベースで別途実装する。
 */
export type User = {
  /** ユーザーの一意識別子（ULID）。 */
  readonly id: UserId;
  /** 表示名。 */
  readonly name: string;
  /** メールアドレス。 */
  readonly email: string;
  /** ロール。 */
  readonly role: UserRole;
  /** 作成日時。 */
  readonly createdAt: Date;
  /** 最終更新日時。 */
  readonly updatedAt: Date;
};

// ---------------------------------------------------------------------------
// ファクトリ関数
// ---------------------------------------------------------------------------

/**
 * 新しいユーザーを作成する。
 *
 * @param params - ユーザーの初期データ
 * @returns 凍結された User オブジェクト
 * @throws {@link DomainError} 名前が空、またはメールアドレスが無効な場合
 */
export const createUser = (params: {
  name: string;
  email: string;
  role: UserRole;
}): User => {
  if (params.name.trim().length === 0) {
    throw new DomainError("User name must not be empty");
  }
  if (!params.email.includes("@")) {
    throw new DomainError("Invalid email format");
  }
  const now = new Date();
  return Object.freeze({
    id: generateId<UserId>(),
    name: params.name.trim(),
    email: params.email,
    role: params.role,
    createdAt: now,
    updatedAt: now,
  });
};

/**
 * 永続化層から復元されたデータで User を再構築する。
 *
 * @remarks
 * DB から読み取った信頼済みデータに対して使用する。バリデーションは行わない。
 *
 * @param data - 復元するユーザーデータ
 * @returns 凍結された User オブジェクト
 */
export const reconstructUser = (data: User): User => Object.freeze(data);

/**
 * ユーザー情報を更新する。
 *
 * @param user - 現在の User 状態
 * @param updates - 更新するフィールド（部分適用）
 * @returns 新しい凍結された User オブジェクト
 * @throws {@link DomainError} 名前が空、またはメールアドレスが無効な場合
 */
export const updateUser = (
  user: User,
  updates: {
    name?: string;
    email?: string;
    role?: UserRole;
  },
): User => {
  if (updates.name !== undefined && updates.name.trim().length === 0) {
    throw new DomainError("User name must not be empty");
  }
  if (updates.email !== undefined && !updates.email.includes("@")) {
    throw new DomainError("Invalid email format");
  }
  return Object.freeze({
    ...user,
    ...updates,
    name: updates.name !== undefined ? updates.name.trim() : user.name,
    updatedAt: new Date(),
  });
};
