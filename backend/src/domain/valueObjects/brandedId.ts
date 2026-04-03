/**
 * Branded 型によるエンティティ ID。
 *
 * @remarks
 * ランタイムでは通常の string だが、コンパイル時に
 * `IssueId` と `UserId` の混同を防止する。
 * ID 生成には UUID v7 を使用し、時刻ソート・オフライン生成に対応する。
 * 内部では標準 UUID 形式、外部公開時は base62 エンコードで短縮する。
 */

import { uuidv7 } from "uuidv7";

/** Branded 型のユーティリティ。T に見えないブランドタグを付与する。 */
type Brand<T, B extends string> = T & { readonly __brand: B };

/** すべての Branded ID 型の共通基底。 */
type BrandedId = Brand<string, string>;

// ---------------------------------------------------------------------------
// ID 型定義
// ---------------------------------------------------------------------------

/** 指摘（Issue）の一意識別子。 */
export type IssueId = Brand<string, "IssueId">;

/** ユーザーの一意識別子。 */
export type UserId = Brand<string, "UserId">;

/** プロジェクトの一意識別子。 */
export type ProjectId = Brand<string, "ProjectId">;

/** ドメインイベントの一意識別子。 */
export type EventId = Brand<string, "EventId">;

/** 写真の一意識別子。 */
export type PhotoId = Brand<string, "PhotoId">;

// ---------------------------------------------------------------------------
// ジェネリック ID 生成 / パース
// ---------------------------------------------------------------------------

/** 新しい Branded ID を UUID v7 で生成する。 */
export const generateId = <T extends BrandedId>(): T => uuidv7() as T;

/** 文字列を Branded ID としてパースする（DB 復元時などに使用）。 */
export const parseId = <T extends BrandedId>(value: string): T => value as T;
