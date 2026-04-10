/**
 * コメント追加ユースケース。
 *
 * @remarks
 * ステータス遷移なしでコメント（写真添付可）を追加する汎用ユースケース。
 * 質問・回答・補足説明など、ステータス遷移を伴わないコミュニケーションに使用する。
 * 写真添付時は confirmed パスを計算してイベントに記録し、Blob は後から移動する。
 */

import { addComment } from "../../domain/entities/issue.js";
import type { CommentAddedEvent } from "../../domain/events/issueEvents.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import { ConcurrencyError } from "../../domain/services/errors.js";
import type {
  CommentId,
  IssueId,
  UserId,
} from "../../domain/valueObjects/brandedId.js";
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

/** addCommentUseCase の入力。 */
export type AddCommentInput = {
  readonly issueId: IssueId;
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

/** addCommentUseCase の成功時の戻り値。 */
export type AddCommentOutput = {
  readonly event: CommentAddedEvent;
};

// ---------------------------------------------------------------------------
// ユースケース
// ---------------------------------------------------------------------------

/**
 * コメント追加ユースケースを生成する高階関数。
 *
 * @param issueRepo - IssueRepository の実装
 * @param blobStorage - BlobStorage の実装
 * @returns コメント追加を実行する非同期関数
 */
export const addCommentUseCase =
  (issueRepo: IssueRepository, blobStorage: BlobStorage) =>
  async (
    input: AddCommentInput,
  ): Promise<Result<AddCommentOutput, DomainErrorDetail>> => {
    const issue = await issueRepo.load(input.issueId);
    if (issue === null) {
      return err({
        code: "ISSUE_NOT_FOUND",
        message: `Issue not found: ${input.issueId}`,
      });
    }

    // 添付写真を confirmed パスに変換してイベントに記録する
    const { confirmedAttachments, pendingPhotos } = resolveAttachments(
      input.issueId,
      input.comment.commentId,
      input.comment.attachments,
    );

    const commentResult = addComment(
      issue,
      input.comment.commentId,
      input.comment.body,
      input.actorId,
      confirmedAttachments,
    );
    if (!commentResult.ok) return commentResult;

    const event = commentResult.value;

    try {
      await issueRepo.save(input.issueId, [event], issue.version);
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

    return { ok: true, value: { event } };
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
