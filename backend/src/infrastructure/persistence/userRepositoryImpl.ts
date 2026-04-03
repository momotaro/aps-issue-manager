import { eq } from "drizzle-orm";
import type { User, UserRole } from "../../domain/entities/user.js";
import { reconstructUser } from "../../domain/entities/user.js";
import type { UserRepository } from "../../domain/repositories/userRepository.js";
import type { UserId } from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import { users } from "./schema.js";
import type { Db } from "./types.js";

type UserRow = typeof users.$inferSelect;

const toDomain = (row: UserRow): User =>
  reconstructUser({
    id: parseId<UserId>(row.id),
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

/** UserRepository を生成する高階関数。 */
export const createUserRepository = (db: Db): UserRepository => ({
  findById: async (id: UserId): Promise<User | null> => {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows.length > 0 ? toDomain(rows[0]) : null;
  },

  findAll: async (): Promise<readonly User[]> => {
    const rows = await db.select().from(users);
    return rows.map(toDomain);
  },

  save: async (user: User): Promise<void> => {
    await db
      .insert(users)
      .values({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: user.name,
          email: user.email,
          role: user.role,
          updatedAt: user.updatedAt,
        },
      });
  },

  findByEmail: async (email: string): Promise<User | null> => {
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows.length > 0 ? toDomain(rows[0]) : null;
  },
});
