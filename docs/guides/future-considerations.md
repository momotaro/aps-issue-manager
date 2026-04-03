# 将来拡張に向けた設計方針

> 現在の技術スタック・アーキテクチャの概要は `CLAUDE.md` を参照。

## 1. クラウド移行

### インフラ移行先

| ローカル | クラウド移行先 |
|---------|--------------|
| PostgreSQL (Docker) | Amazon RDS / Cloud SQL / Azure Database |
| MinIO (Docker) | Amazon S3 / Google Cloud Storage / Azure Blob |
| minio-cleanup | S3 Lifecycle Policy（1日単位で十分） |

### 移行時の影響

- `infrastructure/` 層の実装差し替えのみで対応可能
- `domain/` や `application/` は変更不要（依存性逆転の効果）
- MinIO → S3 は API互換のため、エンドポイント変更のみで移行可能

## 2. 認証・認可

### 追加する場合の設計

- Backend に認証ミドルウェアを追加（Hono middleware）
- JWT ベースの認証（Auth0 / Cognito / Firebase Auth 等）
- ユーザー情報を Context に注入し、useCase に渡す
- Issue に `createdBy`, `assignedTo` を追加

### APS トークンとの関係

- APS の 2-legged OAuth はサーバー間認証（ユーザー認証とは独立）
- ユーザー認証を追加しても、APS トークン取得フローは変わらない

## 3. マルチユーザー対応

### 実装済み

- **User エンティティ**: `domain/entities/user.ts`（admin / manager / member ロール）
- **Project エンティティ**: `domain/entities/project.ts`（modelUrn で APS 3Dモデルと紐付け）
- **Issue 集約に projectId / reporterId / assigneeId を組み込み済み**
- **楽観的同時実行制御**: イベントソーシングの `version` フィールドで実現済み

### 未実装（将来対応）

- ユーザーとプロジェクトの紐付け（RBAC）
- Blob パスにプロジェクトIDを含める: `confirmed/{projectId}/{issueId}/`
- 認証基盤（JWT）との統合

## 4. 大量データ対応

大量データ時のボトルネックは「コンピュート」「DB」「Blob」「キャッシュ」の各レイヤーで異なる。
Lambda + CQRS のようなスケーラブル構成でも、DB やストレージの対策なしには解決しない。

### コンピュートのスケーリング

- Lambda / Cloud Run で同時リクエスト数に応じた自動スケールアウト
- DB 接続数の枯渇に注意 → RDS Proxy / コネクションプールで緩和
- Command（書き込み）と Query（読み取り）でスケール特性が異なるため、CQRS との相性が良い

### Query 側の最適化（CQRS の恩恵）

- 指摘一覧の Query はドメインモデルをバイパスし、DB から直接 DTO を返却
- ページネーション（カーソルベース推奨）
- インデックス最適化（ステータス、プロジェクト、作成日時）
- 検索要件が複雑化した場合、Read モデルを Elasticsearch 等に分離可能（CQRS の延長）

### Blob ストレージ

- 写真のサムネイル生成（アップロード時に Lambda / Cloud Functions で処理）
- CDN 経由での配信（CloudFront / Cloud CDN）

### キャッシュ戦略

- TanStack Query のクライアントキャッシュ（現行）
- Backend に Redis キャッシュ層を追加（Read 頻度が高い場合）

### フロントエンド大量データ対応（段階的導入）

指摘件数の増加に応じて、以下の順序で導入を検討する。

**Phase 1: 差分同期（`updated_at` ベース）**

- 全件取得 → `updated_at` 以降のみ取得に切り替え
- バックエンドに `GET /api/issues?since={ISO8601}` パラメータを追加
- TanStack Query の `staleTime` と組み合わせ、初回以降の通信量を削減
- **前提**: DB スキーマに `updated_at` カラムを初期から組み込み済み

**Phase 2: IndexedDB キャッシュ（〜数万件）**

- TanStack Query のメモリキャッシュだけでは、ページリロード時に全件再取得が発生
- IndexedDB に上限付きキャッシュ（例: 直近 5,000件）を導入し、起動時間を短縮
- キャッシュ → 差分同期 → UI 表示の 3段階で描画
- `idb-keyval` 等の軽量ライブラリで実装可能

**Phase 3: Web Worker フィルタリング（〜10,000件超）**

- メインスレッドでの `Array.filter` が 16ms（1フレーム）を超え始めたら導入を検討
- structured clone のシリアライズコストがあるため、少量データでは逆効果
- フィルタ条件が複雑化した場合（複数条件 AND/OR、全文検索）に特に有効
- 導入閾値の目安: フィルタリング処理が **10ms を超えた時点**

### Entity ID 戦略

- 全エンティティの ID に **UUID v7** を採用
- 時刻順ソート可能（UUID v4 と異なりインデックス効率が良い）
- クライアント側で生成可能 → 将来のオフライン対応・楽観的 UI に対応
- PostgreSQL では `UUID` 型で格納（16バイトのネイティブ型、B-tree インデックス効率が最良）
- **外部 ID（URL・API レスポンス）**: UUID v7 を **base62** エンコードして短縮（36文字 → 22文字）
- **内部 ID（DB・バックエンド間通信）**: UUID v7 をそのまま使用（標準フォーマット `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`）
