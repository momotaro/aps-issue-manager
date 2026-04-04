/**
 * 指摘の新規登録ユースケース。
 *
 * @remarks
 * ドメインの `createIssue` コマンド関数を呼び出し、
 * 生成されたイベントを IssueRepository に保存する。
 * 高階関数 DI パターンで IssueRepository を注入する。
 */

import { createIssue } from "../../domain/entities/issue.js";
import type { IssueCreatedEvent } from "../../domain/events/issueEvents.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import { ConcurrencyError } from "../../domain/services/errors.js";
import type {
  IssueId,
  ProjectId,
  UserId,
} from "../../domain/valueObjects/brandedId.js";
import type { IssueCategory } from "../../domain/valueObjects/issueCategory.js";
import type { Photo } from "../../domain/valueObjects/photo.js";
import type { Position } from "../../domain/valueObjects/position.js";
import type {
  DomainErrorDetail,
  Result,
} from "../../domain/valueObjects/result.js";
import { err } from "../../domain/valueObjects/result.js";

// ---------------------------------------------------------------------------
// 入力型
// ---------------------------------------------------------------------------

/** createIssueUseCase の入力。 */
export type CreateIssueInput = {
  readonly projectId: ProjectId;
  readonly title: string;
  readonly description: string;
  readonly category: IssueCategory;
  readonly position: Position;
  readonly reporterId: UserId;
  readonly assigneeId?: UserId | null;
  readonly photos?: readonly Photo[];
};

// ---------------------------------------------------------------------------
// 出力型
// ---------------------------------------------------------------------------

/** createIssueUseCase の成功時の戻り値。 */
export type CreateIssueOutput = {
  readonly issueId: IssueId;
  readonly event: IssueCreatedEvent;
};

// ---------------------------------------------------------------------------
// ユースケース
// ---------------------------------------------------------------------------

/**
 * 指摘を新規登録するユースケース。
 *
 * @param issueRepo - IssueRepository の実装
 * @returns 入力を受け取り、指摘を作成して保存する非同期関数
 */
export const createIssueUseCase =
  (issueRepo: IssueRepository) =>
  async (
    input: CreateIssueInput,
  ): Promise<Result<CreateIssueOutput, DomainErrorDetail>> => {
    // ドメインコマンドで IssueCreated イベントを生成
    const result = createIssue({
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      category: input.category,
      position: input.position,
      reporterId: input.reporterId,
      assigneeId: input.assigneeId ?? null,
      photos: input.photos ?? [],
      actorId: input.reporterId,
    });

    if (!result.ok) return result;

    const event = result.value;

    try {
      // version 0 = 新規集約（最初のイベントの version は 1）
      await issueRepo.save(event.issueId, [event], 0);
    } catch (error) {
      if (error instanceof ConcurrencyError) {
        return err({ code: "CONCURRENCY_CONFLICT", message: error.message });
      }
      return err({
        code: "SAVE_FAILED",
        message: `Failed to save issue: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return { ok: true, value: { issueId: event.issueId, event } };
  };
