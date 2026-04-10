/**
 * レビュー操作ユースケース。
 *
 * @remarks
 * ステータス遷移（オプション）+ コメント追加を1トランザクションで実行する。
 * 管理者がレビュー（承認/差し戻し）を行う際に使用する。
 * 写真添付は不可（是正操作 correctIssueUseCase を使用すること）。
 */

import {
  addComment,
  applyEvent,
  changeStatus,
} from "../../domain/entities/issue.js";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import { ConcurrencyError } from "../../domain/services/errors.js";
import type {
  CommentId,
  IssueId,
  UserId,
} from "../../domain/valueObjects/brandedId.js";
import type { IssueStatus } from "../../domain/valueObjects/issueStatus.js";
import type {
  DomainErrorDetail,
  Result,
} from "../../domain/valueObjects/result.js";
import { err } from "../../domain/valueObjects/result.js";

// ---------------------------------------------------------------------------
// 入力型
// ---------------------------------------------------------------------------

/** reviewIssueUseCase の入力。 */
export type ReviewIssueInput = {
  readonly issueId: IssueId;
  readonly status?: IssueStatus;
  readonly actorId: UserId;
  readonly comment: {
    readonly commentId: CommentId;
    readonly body: string;
  };
};

// ---------------------------------------------------------------------------
// 出力型
// ---------------------------------------------------------------------------

/** reviewIssueUseCase の成功時の戻り値。 */
export type ReviewIssueOutput = {
  readonly events: readonly IssueDomainEvent[];
};

// ---------------------------------------------------------------------------
// ユースケース
// ---------------------------------------------------------------------------

/**
 * レビュー操作ユースケースを生成する高階関数。
 *
 * @param issueRepo - IssueRepository の実装
 * @returns レビュー操作を実行する非同期関数
 */
export const reviewIssueUseCase =
  (issueRepo: IssueRepository) =>
  async (
    input: ReviewIssueInput,
  ): Promise<Result<ReviewIssueOutput, DomainErrorDetail>> => {
    const issue = await issueRepo.load(input.issueId);
    if (issue === null) {
      return err({
        code: "ISSUE_NOT_FOUND",
        message: `Issue not found: ${input.issueId}`,
      });
    }

    const events: IssueDomainEvent[] = [];
    let current = issue;

    // ステータス遷移（オプション）
    if (input.status !== undefined) {
      const statusResult = changeStatus(current, input.status, input.actorId);
      if (!statusResult.ok) return statusResult;
      events.push(statusResult.value);
      current = applyEvent(current, statusResult.value);
    }

    // コメント追加（必須）
    const commentResult = addComment(
      current,
      input.comment.commentId,
      input.comment.body,
      input.actorId,
    );
    if (!commentResult.ok) return commentResult;
    events.push(commentResult.value);

    try {
      await issueRepo.save(input.issueId, events, issue.version);
    } catch (error) {
      if (error instanceof ConcurrencyError) {
        return err({ code: "CONCURRENCY_CONFLICT", message: error.message });
      }
      return err({
        code: "SAVE_FAILED",
        message: `Failed to save issue: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return { ok: true, value: { events } };
  };
