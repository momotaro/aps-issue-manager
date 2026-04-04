/**
 * BlobStorage インターフェース。
 *
 * @remarks
 * 写真ファイルの永続化を抽象化するドメインサービス。
 * ドメイン層は MinIO/S3 の詳細を知らず、このインターフェースを通じて操作する。
 *
 * ライフサイクル:
 * 1. `uploadPending` — `pending/` プレフィックスにアップロード
 * 2. `confirmPending` — DB 登録後に `confirmed/` プレフィックスへ移動
 * 3. `pending/` の10分超過ファイルは minio-cleanup が自動削除
 */

import type { Photo, PhotoPhase } from "../valueObjects/photo.js";

/**
 * Presigned URL 発行の結果。
 */
export type GenerateUploadUrlResult = {
  /** クライアントがファイルをアップロードするための Presigned URL。 */
  readonly uploadUrl: string;
  /** pending 状態のストレージパス。confirmPending 時に使用する。 */
  readonly pendingPath: string;
};

/**
 * Blob ストレージのインターフェース。
 */
export type BlobStorage = {
  /**
   * ファイルを pending 状態でアップロードする。
   *
   * @remarks
   * アップロード先: `pending/{issueId}/{photoId}.{ext}`
   * DB 登録前の一時保存。10分以内に confirm されなければ自動削除される。
   *
   * @param issueId - 対象の指摘 ID
   * @param photoId - 写真の ID
   * @param data - ファイルのバイナリデータ
   * @param ext - ファイル拡張子（例: `jpg`）
   * @returns アップロード先のストレージパス
   */
  readonly uploadPending: (
    issueId: string,
    photoId: string,
    data: Buffer,
    ext: string,
  ) => Promise<string>;

  /**
   * Presigned URL を発行する。
   *
   * @remarks
   * クライアントが MinIO に直接アップロードするための URL を生成する。
   * アップロード先: `pending/{issueId}/{photoId}.{ext}`
   *
   * @param issueId - 対象の指摘 ID
   * @param photoId - 写真の ID
   * @param fileName - 元のファイル名（拡張子の抽出に使用）
   * @param phase - 撮影フェーズ（before / after）
   * @returns Presigned URL と pending パス
   */
  readonly generateUploadUrl: (
    issueId: string,
    photoId: string,
    fileName: string,
    phase: PhotoPhase,
  ) => Promise<GenerateUploadUrlResult>;

  /**
   * pending 状態のファイルを confirmed に移動する。
   *
   * @remarks
   * 移動先: `confirmed/{issueId}/{phase}/{photoId}.{ext}`
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
   * 個別の写真ファイルを削除する。
   *
   * @remarks
   * `confirmed/{issueId}/{phase}/{photoId}.{ext}` を削除する。
   *
   * @param storagePath - 削除対象のストレージパス
   */
  readonly deletePhoto: (storagePath: string) => Promise<void>;

  /**
   * 指摘に紐づく全ファイルを削除する。
   *
   * @remarks
   * 指摘削除時に呼び出す。`confirmed/{issueId}/` 配下を一括削除する。
   *
   * @param issueId - 対象の指摘 ID
   */
  readonly deleteByIssue: (issueId: string) => Promise<void>;
};
