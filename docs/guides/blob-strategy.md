# Blob ストレージ戦略

> prefix ルール・写真パス・クリーンアップの概要は `CLAUDE.md` を参照。
> 本ドキュメントではフローの詳細と設計判断の根拠を記述する。

## 1. 概要

写真ファイルは MinIO（S3互換）に保存する。
DBにはメタデータ（ファイル名、パス、サイズ等）のみ保持し、
実ファイルはBlobストレージに分離する。

## 2. アップロードフロー（Presigned URL 方式）

```
1. Frontend → Backend: POST /api/issues/:id/photos/upload-url（commentId, fileName を送信）
2. Backend: photoId 生成 → pending/{issueId}/{commentId}/{photoId}.{ext} への Presigned PUT URL を発行 → 返却
3. Frontend → MinIO: Presigned PUT URL でファイルを直接アップロード
4. Frontend → Backend: POST /api/issues/:id/correct（または /comments）で attachments を含むコメントを送信
5. Backend: DB にイベント（CommentAdded）を永続化
6. Backend: MinIO のファイルを confirmed/{issueId}/{commentId}/{photoId}.{ext} に移動（CopyObject + Delete）
7. Backend → Frontend: 完了レスポンス
```

### Presigned URL 方式の利点

- ファイルデータがバックエンドを経由しない → バックエンドの負荷軽減
- 大容量ファイルでもバックエンドのメモリを消費しない
- フロントエンドから MinIO に直接 PUT するため、アップロード速度が向上

### Presigned URL の有効期限

- 10分（600秒）— minio-cleanup の TTL と一致させている
- 期限切れ後にアップロードされなかったケースは minio-cleanup が自動回収

## 3. DBとBlobの整合性戦略

### 問題

「MinIOへのアップロードは成功したが、DB登録に失敗した」場合、
Orphan（孤立）ファイルが `pending/` に残り続ける。

### 解決策：MinIO Client による定期クリーンアップ

`minio-cleanup` コンテナが常駐し、以下を繰り返す:

1. **5分間隔**で `pending/` prefix をスキャン
2. **10分以上経過**したファイルを自動削除

```sh
mc find local/issues/pending/ --older-than 10m --exec 'mc rm {}'
```

### 方式の比較と選定理由

| 方式 | メリット | デメリット | 採用 |
|------|---------|-----------|------|
| MinIO Lifecycle Policy | MinIO 任せで楽 | 最小単位が1日。開発環境で検証しづらい | - |
| Cron + mc find | 任意の間隔で設定可能 | 常駐コンテナが必要 | **採用** |
| Outbox パターン | トランザクション保証 | 実装コスト大。今回の規模では過剰 | - |

### 本番環境への移行時

- MinIO Lifecycle Policy（1日単位）に切り替え、cleanup コンテナを廃止
- または Outbox パターンでトランザクション保証を追加
- S3 への移行時も同じ prefix 戦略が適用可能

## 4. 実装詳細

### パッケージ

- `minio` npm パッケージを使用（MinIO 公式クライアント）
- `presignedPutObject` で Presigned URL を生成
- `copyObject` + `removeObject` で pending → confirmed 移動
- `listObjects` + `removeObjects` で一括削除

### DI パターン

```typescript
// minioClient.ts — クライアント生成
const client = createMinioClient(config);

// blobStorageImpl.ts — BlobStorage 実装
const blobStorage = createBlobStorage(client, bucket);
```
