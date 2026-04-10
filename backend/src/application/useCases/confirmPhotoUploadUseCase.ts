/**
 * 写真アップロード確定ユースケース。
 *
 * @remarks
 * コメント添付写真の pending → confirmed 移動を実行する。
 * 実際のイベント永続化は correct/review/addComment ユースケースが行い、
 * このユースケースは Blob 移動のみを担当する。
 *
 * Blob移動失敗時は pending ファイルが minio-cleanup の TTL(10分) で自動削除される。
 */

import type { BlobStorage } from "../../domain/services/blobStorage.js";
import type { IssueId } from "../../domain/valueObjects/brandedId.js";
import type { Photo } from "../../domain/valueObjects/photo.js";
import type {
  DomainErrorDetail,
  Result,
} from "../../domain/valueObjects/result.js";
import { err } from "../../domain/valueObjects/result.js";

/** ユースケースの入力型。 */
export type ConfirmPhotoUploadInput = {
  readonly issueId: IssueId;
  readonly photos: readonly Photo[];
};

/**
 * 写真アップロード確定ユースケースを生成する高階関数。
 *
 * @param blobStorage - BlobStorage インターフェース
 * @returns ユースケース関数
 */
export const confirmPhotoUploadUseCase =
  (blobStorage: BlobStorage) =>
  async (
    input: ConfirmPhotoUploadInput,
  ): Promise<Result<void, DomainErrorDetail>> => {
    if (input.photos.length === 0) {
      return { ok: true, value: undefined };
    }

    try {
      await blobStorage.confirmPending(input.issueId, input.photos);
    } catch (error) {
      return err({
        code: "CONFIRM_FAILED",
        message: `Failed to confirm pending photos: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return { ok: true, value: undefined };
  };
