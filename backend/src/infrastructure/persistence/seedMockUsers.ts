/**
 * Mock ユーザーを `users` テーブルに冪等に投入するシード関数。
 *
 * @remarks
 * サーバー起動時に呼び出し、監督会社/協力会社の 2 名を users テーブルに登録する。
 * 既に存在する場合は name / email / role を最新に更新する（onConflictDoUpdate）。
 *
 * 将来の認証導入時にはこのシードを削除し、正式なユーザー管理に切り替える。
 */

import { MOCK_USERS } from "../../domain/valueObjects/mockUsers.js";
import { users } from "./schema.js";
import type { Db } from "./types.js";

export const seedMockUsers = async (db: Db): Promise<void> => {
  const now = new Date();
  for (const user of MOCK_USERS) {
    await db
      .insert(users)
      .values({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: user.name,
          email: user.email,
          role: user.role,
          updatedAt: now,
        },
      });
  }
};
