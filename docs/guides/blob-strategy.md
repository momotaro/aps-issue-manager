# Blob ストレージ戦略

> prefix ルール・写真パス・クリーンアップの概要は `CLAUDE.md` を参照。
> 本ドキュメントではフローの詳細と設計判断の根拠を記述する。

## 1. 概要

写真ファイルは MinIO（S3互換）に保存する。
DBにはメタデータ（ファイル名、パス、サイズ等）のみ保持し、
実ファイルはBlobストレージに分離する。

## 2. アップロードフロー

```
1. Frontend → Backend: アップロードリクエスト
2. Backend: pending/ prefix で MinIO にファイル保存
3. Backend: DB にメタデータ + Issue との紐付けを保存
4. Backend: MinIO のファイルを confirmed/ prefix に移動（CopyObject + Delete）
5. Backend → Frontend: 完了レスポンス
```

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
