/**
 * Project エンティティ（単純 CRUD）。
 *
 * @remarks
 * マルチプロジェクト対応のためのプロジェクト情報を管理する。
 * イベントソーシングは使用せず、シンプルな CRUD で永続化する。
 *
 * 1つのプロジェクトは1つの施工現場（建物）に対応し、
 * APS 上の3Dモデル（modelUrn）と紐づく。
 */

import { DomainError } from "../services/errors.js";
import { generateId, type ProjectId } from "../valueObjects/brandedId.js";

// ---------------------------------------------------------------------------
// エンティティ型
// ---------------------------------------------------------------------------

/**
 * プロジェクトエンティティ。
 *
 * @remarks
 * 施工現場単位の管理単位。Issue はすべていずれかの Project に所属する。
 */
export type Project = {
  /** プロジェクトの一意識別子（ULID）。 */
  readonly id: ProjectId;
  /** プロジェクト名（例: 「〇〇ビル新築工事」）。 */
  readonly name: string;
  /** プロジェクトの説明。 */
  readonly description: string;
  /** APS 上の3Dモデル URN。Viewer で表示するモデルを特定する。 */
  readonly modelUrn: string;
  /** 作成日時。 */
  readonly createdAt: Date;
  /** 最終更新日時。 */
  readonly updatedAt: Date;
};

// ---------------------------------------------------------------------------
// ファクトリ関数
// ---------------------------------------------------------------------------

/**
 * 新しいプロジェクトを作成する。
 *
 * @param params - プロジェクトの初期データ
 * @returns 凍結された Project オブジェクト
 * @throws {@link DomainError} プロジェクト名が空の場合
 */
export const createProject = (params: {
  name: string;
  description: string;
  modelUrn: string;
}): Project => {
  if (params.name.trim().length === 0) {
    throw new DomainError("Project name must not be empty");
  }
  const now = new Date();
  return Object.freeze({
    id: generateId<ProjectId>(),
    name: params.name.trim(),
    description: params.description,
    modelUrn: params.modelUrn,
    createdAt: now,
    updatedAt: now,
  });
};

/**
 * 永続化層から復元されたデータで Project を再構築する。
 *
 * @remarks
 * DB から読み取った信頼済みデータに対して使用する。バリデーションは行わない。
 *
 * @param data - 復元するプロジェクトデータ
 * @returns 凍結された Project オブジェクト
 */
export const reconstructProject = (data: Project): Project =>
  Object.freeze(data);

/**
 * プロジェクト情報を更新する。
 *
 * @param project - 現在の Project 状態
 * @param updates - 更新するフィールド（部分適用）
 * @returns 新しい凍結された Project オブジェクト
 * @throws {@link DomainError} プロジェクト名が空の場合
 */
export const updateProject = (
  project: Project,
  updates: {
    name?: string;
    description?: string;
    modelUrn?: string;
  },
): Project => {
  if (updates.name !== undefined && updates.name.trim().length === 0) {
    throw new DomainError("Project name must not be empty");
  }
  return Object.freeze({
    ...project,
    ...updates,
    name: updates.name !== undefined ? updates.name.trim() : project.name,
    updatedAt: new Date(),
  });
};
