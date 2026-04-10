/**
 * 写真の値オブジェクト。Comment の添付物として管理される。
 *
 * @remarks
 * 写真は MinIO（S3互換）に保存され、以下のライフサイクルを経る:
 * 1. アップロード時: `pending/{issueId}/{commentId}/{photoId}.{ext}`
 * 2. DB 登録後: `confirmed/{issueId}/{commentId}/{photoId}.{ext}`
 *
 * `pending/` の10分超過ファイルは minio-cleanup が自動削除する。
 */

import type { PhotoId } from "./brandedId.js";

/**
 * 写真の値オブジェクト。
 *
 * @remarks
 * Comment の attachments として管理される。独立したエンティティではない。
 */
export type Photo = {
  /** 写真の一意識別子（ULID）。 */
  readonly id: PhotoId;
  /** 元のファイル名。 */
  readonly fileName: string;
  /** MinIO 上のストレージパス。 */
  readonly storagePath: string;
  /** アップロード日時。 */
  readonly uploadedAt: Date;
};

/**
 * Photo 値オブジェクトを生成する。
 *
 * @param params - 写真のプロパティ
 * @returns 凍結された Photo オブジェクト
 */
export const createPhoto = (params: {
  id: PhotoId;
  fileName: string;
  storagePath: string;
  uploadedAt: Date;
}): Photo => Object.freeze({ ...params });

/**
 * pending 状態のBlobパスを生成する。
 *
 * @param issueId - 指摘ID
 * @param commentId - コメントID
 * @param photoId - 写真ID
 * @param ext - ファイル拡張子（例: `jpg`）
 */
export const pendingBlobPath = (
  issueId: string,
  commentId: string,
  photoId: string,
  ext: string,
): string => `pending/${issueId}/${commentId}/${photoId}.${ext}`;

/**
 * confirmed 状態のBlobパスを生成する。
 *
 * @param issueId - 指摘ID
 * @param commentId - コメントID
 * @param photoId - 写真ID
 * @param ext - ファイル拡張子（例: `jpg`）
 */
export const confirmedBlobPath = (
  issueId: string,
  commentId: string,
  photoId: string,
  ext: string,
): string => `confirmed/${issueId}/${commentId}/${photoId}.${ext}`;

/**
 * pending パスを解析する。
 *
 * @remarks
 * 形式 `pending/{issueId}/{commentId}/{photoId}.{ext}` と完全一致する場合のみ
 * 解析結果を返す。ディレクトリ区切りやドットが想定外の位置にある場合は `null`。
 *
 * @param storagePath - 検査対象のストレージパス
 * @returns 解析結果（不一致時は `null`）
 */
export const parsePendingPath = (
  storagePath: string,
): {
  issueId: string;
  commentId: string;
  photoId: string;
  ext: string;
} | null => {
  const match = /^pending\/([^/]+)\/([^/]+)\/([^/.]+)\.([^/.]+)$/.exec(
    storagePath,
  );
  if (!match) return null;
  return {
    issueId: match[1],
    commentId: match[2],
    photoId: match[3],
    ext: match[4],
  };
};
