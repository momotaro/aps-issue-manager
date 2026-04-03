import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { updateProject } from "../../domain/entities/project.js";
import {
  generateId,
  type ProjectId,
} from "../../domain/valueObjects/brandedId.js";
import { createProjectRepository } from "./projectRepositoryImpl.js";
import { makeTestProject } from "./testFixtures.js";
import { cleanTables, closeTestDb, getTestDb } from "./testHelper.js";

describe("projectRepositoryImpl（結合テスト）", () => {
  const db = getTestDb();
  const repo = createProjectRepository(db);

  beforeEach(async () => {
    await cleanTables(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("save → findById でプロジェクトを取得できる", async () => {
    const project = makeTestProject();
    await repo.save(project);

    const found = await repo.findById(project.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe("テストプロジェクト");
    expect(found?.modelUrn).toBe("urn:adsk.objects:test-model");
  });

  it("findAll で複数プロジェクトを取得できる", async () => {
    await repo.save(makeTestProject());
    await repo.save(makeTestProject());

    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  it("upsert で既存プロジェクトを更新できる", async () => {
    const project = makeTestProject();
    await repo.save(project);

    const updated = updateProject(project, { name: "更新プロジェクト" });
    await repo.save(updated);

    const found = await repo.findById(project.id);
    expect(found?.name).toBe("更新プロジェクト");
  });

  it("存在しない ID で findById は null を返す", async () => {
    const found = await repo.findById(generateId<ProjectId>());
    expect(found).toBeNull();
  });
});
