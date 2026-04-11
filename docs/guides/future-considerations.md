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

現在は mock ユーザー（監督会社 / 協力会社）による切り替え方式で、認証基盤は未導入。
フロントエンドの Composer 状態×ロール判定は UX のためであり、**セキュリティ境界ではない**。

### 認証基盤の導入

- Backend に Hono middleware で JWT 認証（Auth0 / Cognito / Firebase Auth 等）を追加
- ユーザー情報を Hono Context に注入し useCase に渡す
- `actorId` をリクエスト body から廃止し、middleware のセッションから取得する方式に変更
- Composer の状態×ロール判定を backend 側でも強制し、UI 迂回を防ぐ
- 差し替えポイント: `frontend/src/lib/mock-users.ts` / `frontend/src/components/current-user-provider.tsx` / `frontend/src/repositories/issue-repository.ts` の `actorId` 送信箇所（`TODO(auth)` コメント）
- APS の 2-legged OAuth はサーバー間認証でありユーザー認証とは独立。認証を追加しても APS トークン取得フローは変わらない

### 未対応の強化項目

1. **Timeline コメントページネーション**
   - `GET /:id/comments?before=<ISO8601>&limit=<n>` エンドポイントを新設
   - `IssueQueryService.findCommentsBefore(issueId, before, limit)` を追加
   - `listOlderCommentsUseCase` を追加
   - フロント: `useIssueCommentsTimeline` に `hasMore` / `loadOlder()` を追加し、Timeline に LoadMore ボタンと loadOlder 後のスクロール位置維持を実装

2. **EXIF ストリップ**
   - 写真アップロード時（backend confirm フェーズ）に位置情報等の EXIF をサーバ側で除去
   - プライバシー対策

3. **Presigned URL のサイズ制約**
   - MIME 型チェック（jpg / png / webp / gif / heic）は実装済み
   - `Content-Length` 制約を追加し、過大サイズの投入をブロック

## 3. マルチユーザー対応

User / Project エンティティ、Issue への projectId / reporterId / assigneeId 組み込み、
楽観的同時実行制御（イベントの `version` フィールド）は実装済み。

### 未対応

- **RBAC**: ユーザーとプロジェクトの紐付け、バックエンドでのロールベース権限チェック
- **Blob パスへの projectId 追加**: `confirmed/{projectId}/{issueId}/`（IAM プレフィックス認可・一括削除・Lifecycle 配賦に有効）
- **認証基盤（JWT）との統合**: セクション 2 参照

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
- **前提**: DB スキーマに `updated_at` カラム組み込み済み

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

現在は `ILIKE %keyword%` による部分一致検索（ワイルドカードエスケープ済み）。
小〜中規模データ（数千件程度）では十分だが、以下の課題がある。

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

## 6. ISR / Edge Runtime の適用方針

本番環境（Vercel 等）で Next.js の ISR と Edge Runtime を活用する際の判断基準。

### ISR（Incremental Static Regeneration）

**適用箇所**: 完了済み指摘の詳細画面（`/issues/[id]`）

| 判断基準 | 適用する | 適用しない |
|---------|---------|-----------|
| データの変更頻度 | Done（変更されない） | Open / In Progress（頻繁に更新） |
| リアルタイム性 | 不要 | 必要（TanStack Query が適切） |
| キャッシュ無効化 | `revalidateTag` で即時更新可能 | 即時反映が必須 |

**理由**: Done に遷移した指摘は以降ステータスが変わらないため、静的生成してCDNキャッシュする恩恵が大きい。一方、アクティブな指摘（Open / In Progress）はステータス変更・コメント追加が頻繁に起こるため、クライアントフェッチによるリアルタイム性を優先する。Done 遷移時に `revalidateTag` を発行すれば、完了直後でも最新の内容が即座に反映される。

### Edge Runtime

**適用箇所**: 認証ミドルウェア（JWT 検証）

| 判断基準 | Edge に置く | バックエンドに置く |
|---------|-----------|-----------------|
| Secret が不要 | JWT 検証（公開鍵のみ） | — |
| Secret が必要 | — | APS トークン取得（Client Secret） |
| 処理の性質 | 軽量な暗号演算 | 外部 API 呼び出し + キャッシュ管理 |

**理由**: Edge Runtime はユーザーに最も近い CDN エッジノードで実行されるため、未認証リクエストをオリジンに到達させずにブロックできる（レイテンシ最小化）。JWT の署名検証は Web Crypto API だけで完結し、Edge Runtime の制約（Node.js 全 API が使えない）に収まる。

APS の 2-legged OAuth は Client Secret を必要とするため、エッジ（クライアントに近い場所）に Secret を配置するのはセキュリティリスクになる。また、トークン取得は外部 API 呼び出し + キャッシュ管理を伴い、Edge Runtime の軽量・高速という特性に合わない。これはバックエンド側の責務として `infrastructure/external/` に隔離する（CLAUDE.md の制約事項参照）。
