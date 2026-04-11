/**
 * Mock ユーザーを `users` テーブルに冪等に投入するシード関数。
 *
 * @remarks
 * サーバー起動時に呼び出し、監督会社/協力会社の 2 名を users テーブルに登録する。
 *
 * `users.id` と `users.email` が別々の unique 制約を持つため、
 * `onConflictDoUpdate` を id 単独で張ると、email 側の衝突（例: 別 id で同じ email が
 * 残っている）で落ちてしまう。そのため事前に id または email が一致する既存行を
 * 削除してから再挿入する単純な upsert 戦略を採用する。
 *
 * 本関数は非 production 環境でしか呼ばれない前提（`index.ts` でガード）。
 * 将来の認証導入時にはこのシードごと削除し、正式なユーザー管理に切り替える。
 */

import { eq, or } from "drizzle-orm";
import { MOCK_USERS } from "../../domain/valueObjects/mockUsers.js";
import { users } from "./schema.js";
import type { Db } from "./types.js";

export const seedMockUsers = async (db: Db): Promise<void> => {
  const now = new Date();
  for (const user of MOCK_USERS) {
    await db
      .delete(users)
      .where(or(eq(users.id, user.id), eq(users.email, user.email)));
    await db.insert(users).values({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: now,
      updatedAt: now,
    });
  }
};
