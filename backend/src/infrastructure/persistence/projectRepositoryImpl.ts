import { eq } from "drizzle-orm";
import type { Project } from "../../domain/entities/project.js";
import { reconstructProject } from "../../domain/entities/project.js";
import type { ProjectRepository } from "../../domain/repositories/projectRepository.js";
import type { ProjectId } from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import { projects } from "./schema.js";
import type { Db } from "./types.js";

type ProjectRow = typeof projects.$inferSelect;

const toDomain = (row: ProjectRow): Project =>
  reconstructProject({
    id: parseId<ProjectId>(row.id),
    name: row.name,
    description: row.description,
    modelUrn: row.modelUrn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

/** ProjectRepository を生成する高階関数。 */
export const createProjectRepository = (db: Db): ProjectRepository => ({
  findById: async (id: ProjectId): Promise<Project | null> => {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return rows.length > 0 ? toDomain(rows[0]) : null;
  },

  findAll: async (): Promise<readonly Project[]> => {
    const rows = await db.select().from(projects);
    return rows.map(toDomain);
  },

  save: async (project: Project): Promise<void> => {
    await db
      .insert(projects)
      .values({
        id: project.id,
        name: project.name,
        description: project.description,
        modelUrn: project.modelUrn,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          name: project.name,
          description: project.description,
          modelUrn: project.modelUrn,
          updatedAt: project.updatedAt,
        },
      });
  },
});
