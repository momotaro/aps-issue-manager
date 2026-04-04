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
import type {
  DomainErrorDetail,
  Result,
} from "../../domain/valueObjects/result.js";
import { err } from "../../domain/valueObjects/result.js";

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
  async (
    input: ConfirmPhotoUploadInput,
  ): Promise<Result<void, DomainErrorDetail>> => {
    const issue = await issueRepo.load(input.issueId);
    if (!issue) {
      return err({
        code: "ISSUE_NOT_FOUND",
        message: `Issue not found: ${input.issueId}`,
      });
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
    const confirmedPhotos = await blobStorage.confirmPending(input.issueId, [
      pendingPhoto,
    ]);
    if (confirmedPhotos.length === 0) {
      return err({
        code: "CONFIRM_FAILED",
        message: "Failed to confirm pending photo (file may have expired)",
      });
    }

    // PhotoAdded イベントを生成
    const eventResult = addPhoto(issue, confirmedPhotos[0], input.actorId);
    if (!eventResult.ok) return eventResult;

    // イベントを永続化
    try {
      await issueRepo.save(input.issueId, [eventResult.value], issue.version);
    } catch (error) {
      return err({
        code: "SAVE_FAILED",
        message: `Failed to save issue: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return { ok: true, value: undefined };
  };
