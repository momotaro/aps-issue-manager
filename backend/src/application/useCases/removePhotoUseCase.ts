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
import { NotFoundError } from "../../domain/services/errors.js";
import type {
  IssueId,
  PhotoId,
  UserId,
} from "../../domain/valueObjects/brandedId.js";

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
  async (input: RemovePhotoInput): Promise<void> => {
    // Issue の存在チェック
    const issue = await issueRepo.load(input.issueId);
    if (!issue) {
      throw new NotFoundError("Issue", input.issueId);
    }

    // 写真の存在を確認し、storagePath を取得
    const photo = issue.photos.find((p) => p.id === input.photoId);
    if (!photo) {
      throw new NotFoundError("Photo", input.photoId);
    }

    // PhotoRemoved イベントを生成
    const eventResult = removePhoto(issue, input.photoId, input.actorId);
    if (!eventResult.ok) {
      throw new Error(eventResult.error.message);
    }

    // イベントを先に永続化（データ整合性優先）
    await issueRepo.save(input.issueId, [eventResult.value], issue.version);

    // Blob を削除
    await blobStorage.deletePhoto(photo.storagePath);
  };
