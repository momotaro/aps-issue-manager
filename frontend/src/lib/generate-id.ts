import { createTranslator } from "short-uuid";
import { uuidv7 } from "uuidv7";

const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const translator = createTranslator(BASE62_ALPHABET);

/** base62 エンコードされた UUID v7 を生成する（22文字）。バックエンドの外部 ID 形式と一致。 */
export const generateBase62Id = (): string => translator.fromUUID(uuidv7());
