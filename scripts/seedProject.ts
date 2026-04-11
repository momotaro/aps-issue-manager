import { reconstructProject } from "../backend/src/domain/entities/project.js";
import type { ProjectId } from "../backend/src/domain/valueObjects/brandedId.js";
import { parseId } from "../backend/src/domain/valueObjects/brandedId.js";
import { createProjectRepository } from "../backend/src/infrastructure/persistence/projectRepositoryImpl.js";
import { projects } from "../backend/src/infrastructure/persistence/schema.js";
import type { Db } from "../backend/src/infrastructure/persistence/types.js";

/**
 * フロントエンドの TEMP_PROJECT_ID (base62: "0000000000000000000001") に対応する UUID。
 * フロントエンドがこの固定 ID でクエリするため、シードも同じ ID を使用する。
 */
const SEED_PROJECT_ID = parseId<ProjectId>(
  "00000000-0000-0000-0000-000000000001",
);

export const seedProject = async (db: Db): Promise<ProjectId> => {
  await db.delete(projects);

  const now = new Date();
  const project = reconstructProject({
    id: SEED_PROJECT_ID,
    name: "〇〇ビル新築工事",
    description:
      "地上5階・地下1階の事務所ビル新築工事。鉄骨造、延床面積約3,000m²。",
    modelUrn: "urn:adsk.objects:os.object:sample-bucket/sample-model.rvt",
    createdAt: now,
    updatedAt: now,
  });

  const projectRepo = createProjectRepository(db);
  await projectRepo.save(project);

  return project.id;
};
