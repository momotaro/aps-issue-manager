import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import type { Db } from "./types.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/issue_management_test";

if (
  TEST_DATABASE_URL.includes("issue_management") &&
  !TEST_DATABASE_URL.includes("_test")
) {
  throw new Error(
    "TEST_DATABASE_URL must point to a test database (name should contain '_test'). " +
      "Set TEST_DATABASE_URL explicitly to avoid accidental data loss in development DB.",
  );
}

let _client: ReturnType<typeof postgres> | null = null;
let _db: Db | null = null;

/** テスト用 DB 接続を取得する。 */
export const getTestDb = (): Db => {
  if (!_db) {
    _client = postgres(TEST_DATABASE_URL);
    _db = drizzle(_client, { schema });
  }
  return _db;
};

/** テスト用テーブルを全クリアする。 */
export const cleanTables = async (db: Db): Promise<void> => {
  await db.execute(
    sql`TRUNCATE issue_events, issues_read, issue_snapshots, users, projects CASCADE`,
  );
};

/** テスト用 DB 接続を閉じる。 */
export const closeTestDb = async (): Promise<void> => {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
};
