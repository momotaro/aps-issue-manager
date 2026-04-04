/**
 * 写真アップロード確定ユースケース。
 *
 * @remarks
 * pending 状態の写真を confirmed に移動し、PhotoAdded イベントを記録する。
 * フロントエンドが MinIO へのアップロード完了後に呼び出す。
 */

import { addPhoto } from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import { NotFoundError } from "../../domain/services/errors.js";
import type {
  IssueId,
  PhotoId,
  UserId,
} from "../../domain/valueObjects/brandedId.js";
import {
  createPhoto,
  type PhotoPhase,
  pendingBlobPath,
} from "../../domain/valueObjects/photo.js";

/** ユースケースの入力型。 */
export type ConfirmPhotoUploadInput = {
  readonly issueId: IssueId;
  readonly photoId: PhotoId;
  readonly fileName: string;
  readonly phase: PhotoPhase;
  readonly actorId: UserId;
};

/**
 * 写真アップロード確定ユースケースを生成する高階関数。
 *
 * @param issueRepo - IssueRepository インターフェース
 * @param blobStorage - BlobStorage インターフェース
 * @returns ユースケース関数
 */
export const confirmPhotoUploadUseCase =
  (issueRepo: IssueRepository, blobStorage: BlobStorage) =>
  async (input: ConfirmPhotoUploadInput): Promise<void> => {
    // Issue の存在チェック
    const issue = await issueRepo.load(input.issueId);
    if (!issue) {
      throw new NotFoundError("Issue", input.issueId);
    }

    // ファイル拡張子を取得
    const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";

    // pending パスで Photo 値オブジェクトを作成
    const pendingPath = pendingBlobPath(input.issueId, input.photoId, ext);
    const pendingPhoto = createPhoto({
      id: input.photoId,
      fileName: input.fileName,
      storagePath: pendingPath,
      phase: input.phase,
      uploadedAt: new Date(),
    });

    // pending → confirmed に移動
    const [confirmedPhoto] = await blobStorage.confirmPending(input.issueId, [
      pendingPhoto,
    ]);

    // PhotoAdded イベントを生成
    const eventResult = addPhoto(issue, confirmedPhoto, input.actorId);
    if (!eventResult.ok) {
      throw new Error(eventResult.error.message);
    }

    // イベントを永続化
    await issueRepo.save(input.issueId, [eventResult.value], issue.version);
  };
