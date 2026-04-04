/**
 * 写真アップロード URL 発行ユースケース。
 *
 * @remarks
 * photoId を生成し、BlobStorage の Presigned URL を発行して返却する。
 * フロントエンドはこの URL を使って MinIO に直接アップロードする。
 */

import type { BlobStorage } from "../../domain/services/blobStorage.js";
import {
  generateId,
  type IssueId,
  type PhotoId,
} from "../../domain/valueObjects/brandedId.js";
import type { PhotoPhase } from "../../domain/valueObjects/photo.js";

/** ユースケースの入力型。 */
export type GeneratePhotoUploadUrlInput = {
  readonly issueId: IssueId;
  readonly fileName: string;
  readonly phase: PhotoPhase;
};

/** ユースケースの出力型。 */
export type GeneratePhotoUploadUrlOutput = {
  readonly photoId: PhotoId;
  readonly uploadUrl: string;
};

/**
 * 写真アップロード URL 発行ユースケースを生成する高階関数。
 *
 * @param blobStorage - BlobStorage インターフェース
 * @returns ユースケース関数
 */
export const generatePhotoUploadUrlUseCase =
  (blobStorage: BlobStorage) =>
  async (
    input: GeneratePhotoUploadUrlInput,
  ): Promise<GeneratePhotoUploadUrlOutput> => {
    const photoId = generateId<PhotoId>();

    const { uploadUrl } = await blobStorage.generateUploadUrl(
      input.issueId,
      photoId,
      input.fileName,
      input.phase,
    );

    return { photoId, uploadUrl };
  };
