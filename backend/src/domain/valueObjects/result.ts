/**
 * 関数型の Result 型。ドメイン操作の成功/失敗を例外なしで表現する。
 *
 * @remarks
 * ステータス遷移など「期待される失敗」には Result を使用し、
 * 不変条件違反など「プログラマエラー」には DomainError を throw する。
 */

/** 成功を表す型。 */
export type Ok<T> = { readonly ok: true; readonly value: T };

/** 失敗を表す型。 */
export type Err<E> = { readonly ok: false; readonly error: E };

/** 成功または失敗を表す判別共用体。 */
export type Result<T, E> = Ok<T> | Err<E>;

/** ドメインエラーの詳細。code でプログラム的に判別し、message で人間に説明する。 */
export type DomainErrorDetail = {
  readonly code: string;
  readonly message: string;
};

/** 成功の Result を生成する。 */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

/** 失敗の Result を生成する。 */
export const err = <E>(error: E): Err<E> => ({ ok: false, error });
