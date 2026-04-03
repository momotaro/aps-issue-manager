/**
 * 写真の値オブジェクト。Issue 集約に従属する。
 *
 * @remarks
 * 写真は MinIO（S3互換）に保存され、以下のライフサイクルを経る:
 * 1. アップロード時: `pending/{issueId}/{photoId}.{ext}`
 * 2. DB 登録後: `confirmed/{issueId}/{phase}/{photoId}.{ext}`
 *
 * `pending/` の10分超過ファイルは minio-cleanup が自動削除する。
 */

import type { PhotoId } from "./brandedId.js";

/** 写真の撮影フェーズ。是正前 or 是正後。 */
export type PhotoPhase = "before" | "after";

/**
 * 写真の値オブジェクト。
 *
 * @remarks
 * Issue 集約の一部として管理される。独立したエンティティではない。
 */
export type Photo = {
  /** 写真の一意識別子（ULID）。 */
  readonly id: PhotoId;
  /** 元のファイル名。 */
  readonly fileName: string;
  /** MinIO 上のストレージパス。 */
  readonly storagePath: string;
  /** 撮影フェーズ（是正前 / 是正後）。 */
  readonly phase: PhotoPhase;
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
  phase: PhotoPhase;
  uploadedAt: Date;
}): Photo => Object.freeze({ ...params });

/**
 * pending 状態のBlobパスを生成する。
 *
 * @param issueId - 指摘ID
 * @param photoId - 写真ID
 * @param ext - ファイル拡張子（例: `jpg`）
 */
export const pendingBlobPath = (
  issueId: string,
  photoId: string,
  ext: string,
): string => `pending/${issueId}/${photoId}.${ext}`;

/**
 * confirmed 状態のBlobパスを生成する。
 *
 * @param issueId - 指摘ID
 * @param phase - 撮影フェーズ
 * @param photoId - 写真ID
 * @param ext - ファイル拡張子（例: `jpg`）
 */
export const confirmedBlobPath = (
  issueId: string,
  phase: PhotoPhase,
  photoId: string,
  ext: string,
): string => `confirmed/${issueId}/${phase}/${photoId}.${ext}`;
