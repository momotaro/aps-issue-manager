/**
 * BlobStorage インターフェース。
 *
 * @remarks
 * 写真ファイルの永続化を抽象化するドメインサービス。
 * ドメイン層は MinIO/S3 の詳細を知らず、このインターフェースを通じて操作する。
 *
 * ライフサイクル（Presigned URL 方式）:
 * 1. `generateUploadUrl` — `pending/` プレフィックスへの Presigned PUT URL を発行
 * 2. フロントエンドが Presigned URL で直接アップロード
 * 3. `confirmPending` — DB 登録後に `confirmed/` プレフィックスへ移動
 * 4. `pending/` の10分超過ファイルは minio-cleanup が自動削除
 */

import type { Photo } from "../valueObjects/photo.js";

/**
 * Blob ストレージのインターフェース。
 */
export type BlobStorage = {
  /**
   * 写真アップロード用の Presigned PUT URL を発行する。
   *
   * @remarks
   * アップロード先: `pending/{issueId}/{commentId}/{photoId}.{ext}`
   * DB 登録前の一時保存。10分以内に confirm されなければ自動削除される。
   *
   * @param issueId - 対象の指摘 ID
   * @param commentId - コメント ID
   * @param photoId - 写真の ID
   * @param fileName - 元のファイル名（拡張子を抽出するために使用）
   * @returns Presigned PUT URL
   */
  readonly generateUploadUrl: (
    issueId: string,
    commentId: string,
    photoId: string,
    fileName: string,
  ) => Promise<{ uploadUrl: string; storagePath: string }>;

  /**
   * pending 状態のファイルを confirmed に移動する。
   *
   * @remarks
   * 移動先: `confirmed/{issueId}/{commentId}/{photoId}.{ext}`
   * DB にイベントが永続化された後に呼び出す。
   *
   * @param issueId - 対象の指摘 ID
   * @param photos - 確定対象の写真一覧
   * @returns ストレージパスが更新された写真一覧
   */
  readonly confirmPending: (
    issueId: string,
    photos: readonly Photo[],
  ) => Promise<readonly Photo[]>;

  /**
   * 指摘に紐づく全ファイルを削除する。
   *
   * @remarks
   * 指摘削除時に呼び出す。`confirmed/{issueId}/` 配下を一括削除する。
   *
   * @param issueId - 対象の指摘 ID
   */
  readonly deleteByIssue: (issueId: string) => Promise<void>;

  /**
   * 写真ファイルを個別に削除する。
   *
   * @param storagePath - 削除対象のストレージパス（`confirmed/` プレフィックス）
   */
  readonly deletePhoto: (storagePath: string) => Promise<void>;
};
