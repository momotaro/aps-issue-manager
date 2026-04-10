/**
 * 指摘の新規登録ユースケース。
 *
 * @remarks
 * ドメインの `createIssue` コマンド関数を呼び出し、
 * 生成された2イベント（IssueCreated + CommentAdded）を IssueRepository に保存する。
 * 写真添付時は confirmed パスを計算してイベントに記録し、Blob は後から移動する。
 * 高階関数 DI パターンで IssueRepository + BlobStorage を注入する。
 */

import { createIssue } from "../../domain/entities/issue.js";
import type {
  CommentAddedEvent,
  IssueCreatedEvent,
} from "../../domain/events/issueEvents.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import { ConcurrencyError } from "../../domain/services/errors.js";
import type {
  CommentId,
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
import { resolveAttachments } from "./internal/resolveAttachments.js";

// ---------------------------------------------------------------------------
// 入力型
// ---------------------------------------------------------------------------

/** createIssueUseCase の入力。 */
export type CreateIssueInput = {
  readonly issueId: IssueId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly category: IssueCategory;
  readonly position: Position;
  readonly reporterId: UserId;
  readonly assigneeId?: UserId | null;
  readonly comment: {
    readonly commentId: CommentId;
    readonly body: string;
    readonly attachments?: readonly Photo[];
  };
};

// ---------------------------------------------------------------------------
// 出力型
// ---------------------------------------------------------------------------

/** createIssueUseCase の成功時の戻り値。 */
export type CreateIssueOutput = {
  readonly issueId: IssueId;
  readonly events: readonly [IssueCreatedEvent, CommentAddedEvent];
};

// ---------------------------------------------------------------------------
// ユースケース
// ---------------------------------------------------------------------------

/**
 * 指摘を新規登録するユースケース。
 *
 * @param issueRepo - IssueRepository の実装
 * @param blobStorage - BlobStorage の実装
 * @returns 入力を受け取り、指摘を作成して保存する非同期関数
 */
export const createIssueUseCase =
  (issueRepo: IssueRepository, blobStorage: BlobStorage) =>
  async (
    input: CreateIssueInput,
  ): Promise<Result<CreateIssueOutput, DomainErrorDetail>> => {
    // 添付写真の pending パスを検証し、confirmed パスに変換
    const resolved = resolveAttachments(
      input.issueId,
      input.comment.commentId,
      input.comment.attachments,
    );
    if (!resolved.ok) return resolved;
    const { confirmedAttachments, pendingPhotos } = resolved.value;

    // ドメインコマンドで IssueCreated + CommentAdded イベントを生成
    const result = createIssue({
      issueId: input.issueId,
      projectId: input.projectId,
      title: input.title,
      category: input.category,
      position: input.position,
      reporterId: input.reporterId,
      assigneeId: input.assigneeId ?? null,
      actorId: input.reporterId,
      comment: {
        commentId: input.comment.commentId,
        body: input.comment.body,
        attachments: confirmedAttachments,
      },
    });

    if (!result.ok) return result;

    const events = result.value;

    try {
      // version 0 = 新規集約（最初のイベントの version は 1、2つ目は 2）
      await issueRepo.save(events[0].issueId, events, 0);
    } catch (error) {
      if (error instanceof ConcurrencyError) {
        return err({ code: "CONCURRENCY_CONFLICT", message: error.message });
      }
      return err({
        code: "SAVE_FAILED",
        message: `Failed to save issue: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // pending → confirmed に Blob 移動
    if (pendingPhotos.length > 0) {
      try {
        await blobStorage.confirmPending(input.issueId, pendingPhotos);
      } catch (error) {
        return err({
          code: "CONFIRM_FAILED",
          message: `Failed to confirm pending photos: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return { ok: true, value: { issueId: events[0].issueId, events } };
  };
