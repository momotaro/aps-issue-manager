/**
 * ドメイン層のエラー階層。
 *
 * @remarks
 * ビジネスルールの不変条件違反を表現する。
 * `instanceof` 判定のため、エラー型のみクラスを使用する。
 */

/** ドメイン層の基底エラー。すべてのドメインエラーはこれを継承する。 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

/** 指定されたエンティティが見つからない場合のエラー。 */
export class NotFoundError extends DomainError {
  constructor(
    readonly entity: string,
    readonly id: string,
  ) {
    super(`${entity} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

/** 許可されていないステータス遷移が試行された場合のエラー。 */
export class InvalidTransitionError extends DomainError {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Invalid status transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * 楽観的同時実行制御で競合が検出された場合のエラー。
 *
 * @remarks
 * EventStore への append 時に、expectedVersion と実際の最新 version が
 * 一致しない場合にスローされる。
 */
export class ConcurrencyError extends DomainError {
  constructor(
    readonly aggregateId: string,
    readonly expectedVersion: number,
    readonly actualVersion: number,
  ) {
    super(
      `Concurrency conflict on aggregate ${aggregateId}: expected version ${expectedVersion}, actual ${actualVersion}`,
    );
    this.name = "ConcurrencyError";
  }
}
