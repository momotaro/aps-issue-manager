# Issue #8: MinIO 連携（Presigned URL アップロード・確定・削除）

## 概要

現在 `@aws-sdk/client-s3` で実装されている BlobStorage を `minio` npm パッケージに切り替え、
`uploadPending`（サーバー側でファイルデータを受け取る方式）を削除して Presigned URL 方式に統一する。

## 変更点

### 1. Domain 層: BlobStorage インターフェース更新
- **ファイル**: `backend/src/domain/services/blobStorage.ts`
- `uploadPending` メソッドを削除
- コメントを Presigned URL フローに更新

### 2. Infrastructure 層: minio パッケージ導入 & minioClient.ts 作成
- **パッケージ**: `pnpm --filter backend add minio` & `pnpm --filter backend remove @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- **新規ファイル**: `backend/src/infrastructure/external/minioClient.ts`
  - 環境変数から `Client` インスタンスを生成するファクトリ関数
  - `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`

### 3. Infrastructure 層: blobStorageImpl.ts 書き換え
- **ファイル**: `backend/src/infrastructure/external/blobStorageImpl.ts`
- AWS SDK → `minio` パッケージに全面切り替え
- `uploadPending` 実装を削除
- `generateUploadUrl`: `presignedPutObject` を使用（有効期限 600秒）
- `confirmPending`: `copyObject` + `removeObject`
- `deleteByIssue`: `listObjects` → `removeObjects`
- `deletePhoto`: `removeObject`

### 4. compositionRoot.ts 更新
- **ファイル**: `backend/src/compositionRoot.ts`
- `createMinioClient` を使って Client インスタンスを生成
- `createBlobStorage(client, bucket)` に引数変更

### 5. 単体テスト更新
- `uploadPending` のモック/参照を全テストから削除
- 結合テスト `blobStorageImpl.test.ts` を minio クライアントベースに書き換え

### 6. ドキュメント更新
- `docs/guides/blob-strategy.md`: アップロードフローを Presigned URL 方式に更新

## 実装順序

1. `minio` パッケージインストール & `@aws-sdk` 削除
2. Domain: `BlobStorage` インターフェースから `uploadPending` を削除
3. Infrastructure: `minioClient.ts` 作成
4. Infrastructure: `blobStorageImpl.ts` を `minio` パッケージで書き換え
5. `compositionRoot.ts` 更新
6. テスト更新（単体テスト・結合テスト）
7. ドキュメント更新
8. 品質チェック（test / lint / format / build）

## テスト計画

### 単体テスト（minio クライアントをモック）
- `generateUploadUrl`: 正しいキーで presignedPutObject を呼ぶこと
- `confirmPending`: copyObject → removeObject の順で呼ぶこと、返却パスが confirmed/ であること
- `deleteByIssue`: listObjects → removeObjects を呼ぶこと
- `deletePhoto`: removeObject を呼ぶこと
- バリデーション: 不正な拡張子・ID でエラー

### 結合テスト（実 MinIO）
- `generateUploadUrl`: presigned URL が返却されること
- `confirmPending`: pending → confirmed に移動すること
- `deleteByIssue`: confirmed 配下が全削除されること
