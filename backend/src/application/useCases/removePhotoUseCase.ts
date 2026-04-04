/**
 * 写真削除ユースケース。
 *
 * @remarks
 * Issue から写真を削除し、PhotoRemoved イベントを記録した後、Blob を削除する。
 * イベント永続化を先に行うことで、Blob 削除失敗時もデータ整合性を保つ。
 */

import { removePhoto } from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import type {
  IssueId,
  PhotoId,
  UserId,
} from "../../domain/valueObjects/brandedId.js";
import type {
  DomainErrorDetail,
  Result,
} from "../../domain/valueObjects/result.js";
import { err } from "../../domain/valueObjects/result.js";

/** ユースケースの入力型。 */
export type RemovePhotoInput = {
  readonly issueId: IssueId;
  readonly photoId: PhotoId;
  readonly actorId: UserId;
};

/**
 * 写真削除ユースケースを生成する高階関数。
 *
 * @param issueRepo - IssueRepository インターフェース
 * @param blobStorage - BlobStorage インターフェース
 * @returns ユースケース関数
 */
export const removePhotoUseCase =
  (issueRepo: IssueRepository, blobStorage: BlobStorage) =>
  async (input: RemovePhotoInput): Promise<Result<void, DomainErrorDetail>> => {
    const issue = await issueRepo.load(input.issueId);
    if (!issue) {
      return err({
        code: "ISSUE_NOT_FOUND",
        message: `Issue not found: ${input.issueId}`,
      });
    }

    // 写真の存在を確認し、storagePath を取得
    const photo = issue.photos.find((p) => p.id === input.photoId);
    if (!photo) {
      return err({
        code: "PHOTO_NOT_FOUND",
        message: `Photo not found: ${input.photoId}`,
      });
    }

    // PhotoRemoved イベントを生成
    const eventResult = removePhoto(issue, input.photoId, input.actorId);
    if (!eventResult.ok) return eventResult;

    // イベントを先に永続化（データ整合性優先）
    try {
      await issueRepo.save(input.issueId, [eventResult.value], issue.version);
    } catch (error) {
      return err({
        code: "SAVE_FAILED",
        message: `Failed to save issue: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // Blob を削除
    try {
      await blobStorage.deletePhoto(photo.storagePath);
    } catch (error) {
      return err({
        code: "BLOB_DELETE_FAILED",
        message: `Failed to delete blob: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return { ok: true, value: undefined };
  };
