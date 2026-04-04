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

const BASE62_RE = /^[0-9A-Za-z]{22}$/;

/** 不正なリクエストパラメータを示すエラー。errorHandler で 400 に変換される。 */
export class InvalidParameterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidParameterError";
  }
}

/** UUID 文字列を base62 エンコードされた短縮 ID に変換する（22文字）。 */
export const uuidToBase62 = (uuid: string): string => translator.fromUUID(uuid);

/** base62 エンコードされた短縮 ID を UUID 文字列に復元する。不正な値は InvalidParameterError をスローする。 */
export const base62ToUuid = (encoded: string): string => {
  if (!BASE62_RE.test(encoded)) {
    throw new InvalidParameterError(
      `Invalid base62 ID: ${encoded.slice(0, 30)}`,
    );
  }
  return translator.toUUID(encoded);
};
