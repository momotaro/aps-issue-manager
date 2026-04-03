/**
 * UserRepository インターフェース。
 *
 * @remarks
 * ユーザーエンティティの標準 CRUD 永続化を抽象化する。
 * 実装は `infrastructure/persistence/` に置く。
 */

import type { User } from "../entities/user.js";
import type { UserId } from "../valueObjects/brandedId.js";
import type { CrudRepository } from "./crudRepository.js";

/** ユーザーの永続化インターフェース。 */
export type UserRepository = CrudRepository<User, UserId> & {
  /**
   * メールアドレスでユーザーを取得する。
   * ログイン時やユーザー登録時の重複チェックに使用する。
   */
  readonly findByEmail: (email: string) => Promise<User | null>;
};
