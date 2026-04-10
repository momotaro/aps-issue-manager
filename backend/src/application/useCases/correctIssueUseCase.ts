/**
 * 是正操作ユースケース。
 *
 * @remarks
 * ステータス遷移（オプション）+ コメント追加（写真添付可）を1トランザクションで実行する。
 * 施工者が是正作業を行い、是正完了を報告する際に使用する。
 *
 * 複数イベント生成時は applyEvent で中間状態を作成し、version を連番管理する。
 * 写真添付時は confirmed パスを計算してイベントに記録し、Blob は後から移動する。
 */

import {
  addComment,
  applyEvent,
  changeStatus,
} from "../../domain/entities/issue.js";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import { ConcurrencyError } from "../../domain/services/errors.js";
import type {
  CommentId,
  IssueId,
  UserId,
} from "../../domain/valueObjects/brandedId.js";
import type { IssueStatus } from "../../domain/valueObjects/issueStatus.js";
import type { Photo } from "../../domain/valueObjects/photo.js";
import { confirmedBlobPath } from "../../domain/valueObjects/photo.js";
import type {
  DomainErrorDetail,
  Result,
} from "../../domain/valueObjects/result.js";
import { err } from "../../domain/valueObjects/result.js";

// ---------------------------------------------------------------------------
// 入力型
// ---------------------------------------------------------------------------

/** correctIssueUseCase の入力。 */
export type CorrectIssueInput = {
  readonly issueId: IssueId;
  readonly status?: IssueStatus;
  readonly actorId: UserId;
  readonly comment: {
    readonly commentId: CommentId;
    readonly body: string;
    readonly attachments?: readonly Photo[];
  };
};

// ---------------------------------------------------------------------------
// 出力型
// ---------------------------------------------------------------------------

/** correctIssueUseCase の成功時の戻り値。 */
export type CorrectIssueOutput = {
  readonly events: readonly IssueDomainEvent[];
};

// ---------------------------------------------------------------------------
// ユースケース
// ---------------------------------------------------------------------------

/**
 * 是正操作ユースケースを生成する高階関数。
 *
 * @param issueRepo - IssueRepository の実装
 * @param blobStorage - BlobStorage の実装
 * @returns 是正操作を実行する非同期関数
 */
export const correctIssueUseCase =
  (issueRepo: IssueRepository, blobStorage: BlobStorage) =>
  async (
    input: CorrectIssueInput,
  ): Promise<Result<CorrectIssueOutput, DomainErrorDetail>> => {
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

    // 添付写真を confirmed パスに変換してイベントに記録する
    const { confirmedAttachments, pendingPhotos } = resolveAttachments(
      input.issueId,
      input.comment.commentId,
      input.comment.attachments,
    );

    // コメント追加（必須）— confirmed パスで記録
    const commentResult = addComment(
      current,
      input.comment.commentId,
      input.comment.body,
      input.actorId,
      confirmedAttachments,
    );
    if (!commentResult.ok) return commentResult;
    events.push(commentResult.value);

    // イベントを先に永続化（データ整合性優先）
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

    return { ok: true, value: { events } };
  };

/**
 * pending パスの添付写真を confirmed パスに変換する。
 * イベントには confirmed パスを記録し、Blob 移動用に pending Photo を返す。
 */
const resolveAttachments = (
  issueId: IssueId,
  commentId: CommentId,
  attachments?: readonly Photo[],
): {
  confirmedAttachments?: readonly Photo[];
  pendingPhotos: readonly Photo[];
} => {
  if (!attachments || attachments.length === 0) {
    return { confirmedAttachments: undefined, pendingPhotos: [] };
  }

  const pendingPhotos: Photo[] = [];
  const confirmedAttachments = attachments.map((photo) => {
    if (!photo.storagePath.startsWith("pending/")) return photo;

    pendingPhotos.push(photo);
    const ext = photo.fileName.split(".").pop()?.toLowerCase() ?? "";
    const confirmedPath = confirmedBlobPath(issueId, commentId, photo.id, ext);
    return { ...photo, storagePath: confirmedPath };
  });

  return { confirmedAttachments, pendingPhotos };
};
