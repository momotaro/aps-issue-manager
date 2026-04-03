/**
 * ProjectRepository インターフェース。
 *
 * @remarks
 * プロジェクトエンティティの標準 CRUD 永続化を抽象化する。
 * 実装は `infrastructure/persistence/` に置く。
 */

import type { Project } from "../entities/project.js";
import type { ProjectId } from "../valueObjects/brandedId.js";
import type { CrudRepository } from "./crudRepository.js";

/** プロジェクトの永続化インターフェース。 */
export type ProjectRepository = CrudRepository<Project, ProjectId>;
