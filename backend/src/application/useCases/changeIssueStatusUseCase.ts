/**
 * 指摘ステータス遷移ユースケース。
 *
 * @remarks
 * ドメイン層の状態マシンに従ってステータスを遷移し、イベントを永続化する。
 * 無効な遷移はドメインエラーとして Result で返却する。
 */

import { changeStatus } from "../../domain/entities/issue.js";
import type { IssueStatusChangedEvent } from "../../domain/events/issueEvents.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { IssueId, UserId } from "../../domain/valueObjects/brandedId.js";
import type { IssueStatus } from "../../domain/valueObjects/issueStatus.js";
import type {
  DomainErrorDetail,
  Result,
} from "../../domain/valueObjects/result.js";
import { err } from "../../domain/valueObjects/result.js";

/** ユースケースの入力型。 */
export type ChangeIssueStatusInput = {
  readonly issueId: IssueId;
  readonly newStatus: IssueStatus;
  readonly actorId: UserId;
};

/** ユースケースの出力型。 */
export type ChangeIssueStatusOutput = {
  readonly event: IssueStatusChangedEvent;
};

/**
 * ステータス遷移ユースケースを生成する高階関数。
 *
 * @param issueRepo - IssueRepository の実装
 * @returns ステータス遷移を実行する非同期関数
 */
export const changeIssueStatusUseCase =
  (issueRepo: IssueRepository) =>
  async (
    input: ChangeIssueStatusInput,
  ): Promise<Result<ChangeIssueStatusOutput, DomainErrorDetail>> => {
    const issue = await issueRepo.load(input.issueId);
    if (issue === null) {
      return err({
        code: "ISSUE_NOT_FOUND",
        message: `Issue not found: ${input.issueId}`,
      });
    }

    const result = changeStatus(issue, input.newStatus, input.actorId);
    if (!result.ok) return result;

    const event = result.value;

    try {
      await issueRepo.save(input.issueId, [event], issue.version);
    } catch (error) {
      return err({
        code: "SAVE_FAILED",
        message: `Failed to save issue: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return { ok: true, value: { event } };
  };
