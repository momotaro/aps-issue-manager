/**
 * 指摘の基本情報更新ユースケース。
 *
 * @remarks
 * タイトル・種別・担当者の変更をコマンド関数経由で実行し、
 * 生成されたイベントをまとめて IssueRepository に保存する。
 * 高階関数 DI パターンで IssueRepository を注入する。
 */

import type { Issue } from "../../domain/entities/issue.js";
import {
  applyEvent,
  changeAssignee,
  changeCategory,
  updateTitle,
} from "../../domain/entities/issue.js";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import { ConcurrencyError } from "../../domain/services/errors.js";
import type { IssueId, UserId } from "../../domain/valueObjects/brandedId.js";
import type { IssueCategory } from "../../domain/valueObjects/issueCategory.js";
import type {
  DomainErrorDetail,
  Result,
} from "../../domain/valueObjects/result.js";
import { err } from "../../domain/valueObjects/result.js";

// ---------------------------------------------------------------------------
// 入力型
// ---------------------------------------------------------------------------

/** updateIssueUseCase の入力。変更したいフィールドのみ指定する。 */
export type UpdateIssueInput = {
  readonly issueId: IssueId;
  readonly title?: string;
  readonly category?: IssueCategory;
  readonly assigneeId?: UserId | null;
  readonly actorId: UserId;
};

// ---------------------------------------------------------------------------
// 出力型
// ---------------------------------------------------------------------------

/** updateIssueUseCase の成功時の戻り値。 */
export type UpdateIssueOutput = {
  readonly events: readonly IssueDomainEvent[];
};

// ---------------------------------------------------------------------------
// ユースケース
// ---------------------------------------------------------------------------

/**
 * 指摘の基本情報を更新するユースケース。
 *
 * @param issueRepo - IssueRepository の実装
 * @returns 入力を受け取り、指摘を更新して保存する非同期関数
 */
export const updateIssueUseCase =
  (issueRepo: IssueRepository) =>
  async (
    input: UpdateIssueInput,
  ): Promise<Result<UpdateIssueOutput, DomainErrorDetail>> => {
    // 集約の読み込み
    const issue = await issueRepo.load(input.issueId);
    if (issue === null) {
      return err({
        code: "ISSUE_NOT_FOUND",
        message: `Issue ${input.issueId} not found`,
      });
    }

    const events: IssueDomainEvent[] = [];
    let current: Issue = issue;

    // タイトル更新
    if (input.title !== undefined) {
      const result = updateTitle(current, input.title, input.actorId);
      if (!result.ok) return result;
      events.push(result.value);
      current = applyEvent(current, result.value);
    }

    // 種別変更
    if (input.category !== undefined) {
      const result = changeCategory(current, input.category, input.actorId);
      if (!result.ok) return result;
      events.push(result.value);
      current = applyEvent(current, result.value);
    }

    // 担当者変更
    if (input.assigneeId !== undefined) {
      const result = changeAssignee(current, input.assigneeId, input.actorId);
      if (!result.ok) return result;
      events.push(result.value);
      current = applyEvent(current, result.value);
    }

    // 変更がない場合
    if (events.length === 0) {
      return err({
        code: "NO_CHANGES",
        message: "No fields to update",
      });
    }

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
