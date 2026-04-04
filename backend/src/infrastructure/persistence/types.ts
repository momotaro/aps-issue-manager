import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type {
  PostgresJsDatabase,
  PostgresJsQueryResultHKT,
} from "drizzle-orm/postgres-js";
import type * as schema from "./schema.js";

/** Drizzle DB インスタンスの型。 */
export type Db = PostgresJsDatabase<typeof schema>;

/** Drizzle トランザクションの型。 */
export type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
