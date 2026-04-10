/**
 * 添付写真の pending パスを検証・正規化して confirmed パスに変換する共通ヘルパー。
 *
 * @remarks
 * pending パスを `pending/{issueId}/{commentId}/{photoId}.{ext}` 形式と完全一致するか検証し、
 * 入力された issueId/commentId/photoId と整合しない場合は `INVALID_ATTACHMENT_PATH` を返す。
 * これにより、クライアントが不正なパスを送った場合に DB 記録と Blob 実体がズレるのを防ぐ。
 */

import type {
  CommentId,
  IssueId,
} from "../../../domain/valueObjects/brandedId.js";
import type { Photo } from "../../../domain/valueObjects/photo.js";
import {
  confirmedBlobPath,
  parsePendingPath,
} from "../../../domain/valueObjects/photo.js";
import type {
  DomainErrorDetail,
  Result,
} from "../../../domain/valueObjects/result.js";
import { err, ok } from "../../../domain/valueObjects/result.js";

export type ResolvedAttachments = {
  /** イベントに記録する用の添付配列（confirmed パスに書き換え済み）。空配列時は `undefined`。 */
  readonly confirmedAttachments?: readonly Photo[];
  /** `blobStorage.confirmPending` に渡す pending Photo の配列。 */
  readonly pendingPhotos: readonly Photo[];
};

/**
 * 添付写真の pending パスを検証し、confirmed パスに変換する。
 *
 * @param issueId - 紐づく指摘ID
 * @param commentId - 紐づくコメントID
 * @param attachments - クライアントから渡された添付写真
 * @returns 成功時は変換結果、失敗時は `INVALID_ATTACHMENT_PATH` エラー
 */
export const resolveAttachments = (
  issueId: IssueId,
  commentId: CommentId,
  attachments: readonly Photo[] | undefined,
): Result<ResolvedAttachments, DomainErrorDetail> => {
  if (!attachments || attachments.length === 0) {
    return ok({ confirmedAttachments: undefined, pendingPhotos: [] });
  }

  const pendingPhotos: Photo[] = [];
  const confirmedAttachments: Photo[] = [];

  for (const photo of attachments) {
    if (!photo.storagePath.startsWith("pending/")) {
      // 既に confirmed 済みのパスはそのまま通す（再送時などを想定）。
      confirmedAttachments.push(photo);
      continue;
    }

    const parsed = parsePendingPath(photo.storagePath);
    if (
      parsed === null ||
      parsed.issueId !== issueId ||
      parsed.commentId !== commentId ||
      parsed.photoId !== photo.id
    ) {
      return err({
        code: "INVALID_ATTACHMENT_PATH",
        message: `Attachment storagePath must match "pending/${issueId}/${commentId}/${photo.id}.{ext}": got "${photo.storagePath}"`,
      });
    }

    pendingPhotos.push(photo);
    const confirmedPath = confirmedBlobPath(
      issueId,
      commentId,
      photo.id,
      parsed.ext,
    );
    confirmedAttachments.push({ ...photo, storagePath: confirmedPath });
  }

  return ok({ confirmedAttachments, pendingPhotos });
};
