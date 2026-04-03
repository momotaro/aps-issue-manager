/**
 * CRUD リポジトリの共通インターフェース。
 *
 * @remarks
 * エンティティごとの固有メソッドは交差型で拡張する。
 *
 * @example
 * ```typescript
 * type UserRepository = CrudRepository<User, UserId> & {
 *   readonly findByEmail: (email: string) => Promise<User | null>;
 * };
 * ```
 */
export type CrudRepository<T, ID> = {
  /** ID でエンティティを取得する。存在しない場合は `null`。 */
  readonly findById: (id: ID) => Promise<T | null>;

  /** 全エンティティを取得する。 */
  readonly findAll: () => Promise<readonly T[]>;

  /** エンティティを保存する（新規作成・更新の両方に対応）。 */
  readonly save: (entity: T) => Promise<void>;
};
