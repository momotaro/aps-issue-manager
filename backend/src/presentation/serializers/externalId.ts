/**
 * 外部 ID 変換（UUID ↔ base62）。
 *
 * API のリクエスト/レスポンス境界で使用する。
 * application 層以下は UUID のみを扱い、base62 の存在を知らない。
 */

import { createTranslator } from "short-uuid";

const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const translator = createTranslator(BASE62_ALPHABET);

/** UUID 文字列を base62 エンコードされた短縮 ID に変換する（22文字）。 */
export const uuidToBase62 = (uuid: string): string => translator.fromUUID(uuid);

/** base62 エンコードされた短縮 ID を UUID 文字列に復元する。 */
export const base62ToUuid = (encoded: string): string =>
  translator.toUUID(encoded);
