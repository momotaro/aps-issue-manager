import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { updateUser } from "../../domain/entities/user.js";
import {
  generateId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import { makeTestUser } from "./testFixtures.js";
import { cleanTables, closeTestDb, getTestDb } from "./testHelper.js";
import { createUserRepository } from "./userRepositoryImpl.js";

describe("userRepositoryImpl（結合テスト）", () => {
  const db = getTestDb();
  const repo = createUserRepository(db);

  beforeEach(async () => {
    await cleanTables(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("save → findById でユーザーを取得できる", async () => {
    const user = makeTestUser({ name: "佐藤", email: "sato@example.com" });
    await repo.save(user);

    const found = await repo.findById(user.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe("佐藤");
    expect(found?.email).toBe("sato@example.com");
    expect(found?.role).toBe("member");
  });

  it("findAll で複数ユーザーを取得できる", async () => {
    const user1 = makeTestUser({ name: "佐藤", email: "sato@example.com" });
    const user2 = makeTestUser({ name: "田中", email: "tanaka@example.com" });
    await repo.save(user1);
    await repo.save(user2);

    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  it("findByEmail でユーザーを取得できる", async () => {
    const user = makeTestUser({ name: "佐藤", email: "sato@example.com" });
    await repo.save(user);

    const found = await repo.findByEmail("sato@example.com");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("佐藤");
  });

  it("upsert で既存ユーザーを更新できる", async () => {
    const user = makeTestUser({ name: "佐藤", email: "sato@example.com" });
    await repo.save(user);

    const updated = updateUser(user, { name: "佐藤（更新）" });
    await repo.save(updated);

    const found = await repo.findById(user.id);
    expect(found?.name).toBe("佐藤（更新）");
  });

  it("存在しない ID で findById は null を返す", async () => {
    const found = await repo.findById(generateId<UserId>());
    expect(found).toBeNull();
  });

  it("存在しない email で findByEmail は null を返す", async () => {
    const found = await repo.findByEmail("nonexistent@example.com");
    expect(found).toBeNull();
  });
});
