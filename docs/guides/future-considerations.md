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

### 現状（mock ユーザー）

- 認証なし。`frontend/src/lib/mock-users.ts` に 2 名の mock ユーザー（監督会社 / 協力会社）を定義
- `useCurrentUser()` (zustand + persist) で切り替え、UserSwitcher UI で操作者を選択
- Repository から `actorId` を body に含めて送信する暫定実装
- **重要**: 現 UI のボタン出し分け（Composer の状態×ロール判定）は UX のためであり、**セキュリティ境界ではない**。クライアントが直接 API を叩けばロールを迂回できる

### 追加する場合の設計

- Backend に認証ミドルウェアを追加（Hono middleware）
- JWT ベースの認証（Auth0 / Cognito / Firebase Auth 等）
- ユーザー情報を Context に注入し、useCase に渡す
- Issue に `createdBy`, `assignedTo` を追加

### APS トークンとの関係

- APS の 2-legged OAuth はサーバー間認証（ユーザー認証とは独立）
- ユーザー認証を追加しても、APS トークン取得フローは変わらない

### follow-up Issue として切り出し予定のスコープ

#34（フロントエンドのユースケース指向 API 対応）の範囲外として、以下を独立 Issue で扱う:

1. **認可ミドルウェア + `actorId` 廃止**
   - backend に認証/認可ミドルウェアを導入し、ロールガード（IDOR 対策含む）を追加
   - `actorId` をリクエスト body から廃止し、middleware のセッションから取得する方式に変更
   - Composer の状態×ロール判定を backend 側でも強制し、UI 迂回を防ぐ
   - 差し替えポイント: `frontend/src/lib/mock-users.ts` / `current-user.hooks.ts` / `issue-repository.ts` の `actorId` 送信箇所（`TODO(auth)` コメント）

2. **Timeline コメントページネーション**
   - `GET /:id/comments?before=<ISO8601>&limit=<n>` エンドポイントを新設
   - `IssueQueryService.findCommentsBefore(issueId, before, limit)` を追加
   - `listOlderCommentsUseCase` を追加
   - フロント: `useIssueCommentsTimeline` に `hasMore` / `loadOlder()` を追加し、Timeline に LoadMore ボタンと loadOlder 後のスクロール位置維持を実装
   - `.pen` に `LoadMore` ノードを復活
   - #34 時点では `getIssueDetail.recentComments`（最新 5 件）のみ表示

3. **EXIF ストリップ**
   - 写真アップロード時（backend confirm フェーズ）に位置情報等の EXIF をサーバ側で除去
   - プライバシー対策

4. **Presigned URL の MIME / サイズ制約**
   - backend の presigned URL 発行時に `Content-Type` と `Content-Length` 制約を付与
   - 任意バイナリや過大サイズの投入をブロック

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

- サムネイル自動生成（アップロード confirm 時に Lambda / Cloud Functions でリサイズ）
  - 複数サイズ生成: original, medium (800px), thumbnail (200px)
  - WebP 変換でファイルサイズ削減
  - 保存先: `confirmed/{issueId}/{commentId}/{photoId}_thumb.webp`
- CDN 経由での配信（CloudFront / Cloud CDN）
  - 現在は MinIO の公開読み取りポリシーで配信（開発環境）
  - 本番では Presigned GET URL または CDN に切り替え
- プログレッシブローディング: サムネイル → 高解像度の段階的表示

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

## 5. 全文検索

### 現状（ILIKE 部分一致）

- `GET /api/issues?q=keyword` でタイトル・説明を `ILIKE %keyword%` で部分一致検索
- PostgreSQL のネイティブ機能のみで実現（追加インフラ不要）
- 小〜中規模データ（数千件程度）では十分なパフォーマンス
- ワイルドカード文字（`%`, `_`）はアプリケーション層でエスケープ済み

### 課題

- ILIKE は全行スキャンが必要（インデックスが効かない）
- データ量増加時（数万件〜）にクエリコストが線形に増加
- 日本語形態素解析や同義語展開には対応不可

### 将来移行方針（Elasticsearch / OpenSearch）

- CQRS の Read モデル分離の延長として、検索インデックスを外部サービスに分離可能
- イベントソーシングの EventProjector と同様に、イベント発生時に検索インデックスを更新
- 移行ステップ:
  1. Elasticsearch / OpenSearch クラスタを構築
  2. `IssueQueryService` に検索専用メソッドを追加（既存 `findAll` は変更不要）
  3. `infrastructure/` 層に Elasticsearch 用の実装を追加（依存性逆転により `domain/` は影響なし）
  4. EventProjector に検索インデックス更新ロジックを追加
- `pg_trgm` 拡張による GIN インデックスも中間策として検討可能

### Entity ID 戦略

- 全エンティティの ID に **UUID v7** を採用
- 時刻順ソート可能（UUID v4 と異なりインデックス効率が良い）
- クライアント側で生成可能 → 将来のオフライン対応・楽観的 UI に対応
- PostgreSQL では `UUID` 型で格納（16バイトのネイティブ型、B-tree インデックス効率が最良）
- **外部 ID（URL・API レスポンス）**: UUID v7 を **base62** エンコードして短縮（36文字 → 22文字）
- **内部 ID（DB・バックエンド間通信）**: UUID v7 をそのまま使用（標準フォーマット `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`）
