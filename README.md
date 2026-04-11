# 指摘管理ツール

施工現場向けの BIM 連携指摘管理アプリケーション。APS Viewer 上の 3D モデルにピンを立て、
指摘（Issue）の登録・写真添付・ステータス管理・位置への再移動を一元的に行う。

- 指摘に 3D 上の位置（部材 `dbId` / 空間 `worldPosition`）を紐づける
- 写真（是正前 / 是正後）を複数枚添付し、Lightbox で投稿者・コメントと一緒に閲覧できる
- ステータス（Open / In Progress / In Review / Done）を遷移管理する
- コメント・ステータス変更・編集履歴を 1 本のタイムラインとして一覧できる
- 一覧から 3D 上の該当箇所へ即座に移動できる

---

## クイックスタート

### 前提条件

- Node.js 22、pnpm、Docker / Docker Compose

### 起動手順

```bash
# 1. 環境変数を設定
cp frontend/.env.sample frontend/.env
cp backend/.env.sample backend/.env
# backend/.env に APS_CLIENT_ID / APS_CLIENT_SECRET / MODEL_URN を設定

# 2. 全サービス起動（初回はビルドあり）
docker compose up --build -d

# 3. DB マイグレーション（初回 / スキーマ変更時）
pnpm -w data:migrate

# 4. ダミーデータ投入（任意・冪等）
pnpm -w data:seed
```

### アクセス URL

| サービス       | URL                          |
| -------------- | ---------------------------- |
| Frontend       | http://localhost:3000        |
| Backend        | http://localhost:4000        |
| Backend Health | http://localhost:4000/health |
| MinIO Console  | http://localhost:9001        |

詳細: [`docs/guides/development.md`](./docs/guides/development.md)

---

## 基本操作

画面はヘッダー・3D ビューア・指摘詳細パネル・指摘一覧パネルの 3 カラム構成。

### ユーザー切り替え

ヘッダー右端のセグメントトグルで **監督会社 / 協力会社** を切り替える。
選択中のユーザーによって、各ステータスで実行できるアクション（承認・差し戻し・是正完了など）が変わる。

### 指摘の登録

1. 指摘一覧パネル右上の **＋** ボタンをクリック → 配置モードに入る
2. 3D モデル上でクリックしてピンを配置（部材をクリックすると `dbId` が、空間をクリックすると `worldPosition` が記録される）
3. 詳細パネルにフォームが表示されるので、タイトル・カテゴリ・担当者を入力
4. コメント欄にテキストと写真（任意）を添付し、**作成** をクリック

配置モード中は ESC でキャンセルできる。

### 指摘の閲覧・3D 位置への移動

- 指摘一覧パネルのカードをクリック → カメラが 3D 上の該当箇所へ自動移動し、詳細パネルが開く
- 3D ビューア上のピンを直接クリックしても同様

### ステータス遷移

詳細パネル下部のアクションバーからステータスを進める。
操作可能なアクションは現在のユーザー（監督会社 / 協力会社）とステータスの組み合わせで決まる。

| ステータス | 協力会社 | 監督会社 |
| ---------- | -------- | -------- |
| Open | **作業開始** → In Progress | — |
| In Progress | **是正完了** → In Review（写真添付可） | — |
| In Review | — | **承認** → Done / **差し戻し** → In Progress |
| Done | — | — |

どのステータスでも両者ともコメントの投稿は可能。

### コメント・履歴タイムライン

詳細パネルの中央にコメントとステータス変更履歴が時系列で表示される。
コメントに添付された写真はサムネイルで表示され、クリックすると Lightbox で拡大表示できる。

---

## ディレクトリ構成（抜粋）

```
test_prj/
├── frontend/                    # Next.js App Router（:3000）
│   └── src/
│       ├── app/                 # ページ（App Router）
│       ├── components/          # UI コンポーネント（*.tsx）+ ロジック（*.hooks.ts）
│       ├── repositories/        # データ取得の抽象化（TanStack Query）
│       ├── lib/                 # API クライアント・写真 URL 生成・日時フォーマット等
│       └── types/               # Issue 型・APS Viewer 型定義
├── backend/                     # Hono API サーバー（:4000）
│   └── src/
│       ├── presentation/routes/ # Hono ルート定義
│       ├── application/useCases/# ユースケース（高階関数 DI, useCase 単位の粒度）
│       ├── domain/
│       │   ├── entities/        # Issue 集約（applyEvent, rehydrate, コマンド関数）
│       │   ├── events/          # ドメインイベント型定義
│       │   ├── valueObjects/    # Status, Position, Photo（遷移ルール含む）
│       │   ├── repositories/    # Repository / QueryService インターフェース
│       │   └── services/        # BlobStorage インターフェース・エラー型
│       ├── infrastructure/
│       │   ├── adapter/         # PostgreSQL（Drizzle）接続
│       │   ├── persistence/     # EventStore / IssueRepository 等の Drizzle 実装
│       │   └── external/        # APS・MinIO クライアント実装
│       └── compositionRoot.ts   # 依存の組み立て（DI ルート）
├── docker-compose.yml
├── biome.json                   # Lint / Format（全ワークスペース一括）
└── docs/guides/                 # 設計ドキュメント
```

依存方向: `presentation → application → domain ← infrastructure`

---

## データ管理

```bash
# ダミーデータ投入（128件の指摘 + プロジェクト + ユーザー。冪等：何度でも実行可能）
pnpm -w data:seed

# 全データ削除
pnpm -w data:clear

# DBマイグレーション実行
pnpm -w data:migrate
```

---

## テスト

```bash
# Docker 起動（結合テストに必要）
docker compose up -d

# テスト用 DB セットアップ（初回のみ）
docker compose exec db psql -U postgres -c "CREATE DATABASE issue_management_test"
DATABASE_URL="postgres://postgres:postgres@localhost:5432/issue_management_test" pnpm --filter backend exec drizzle-kit push

# テスト実行（単体 + 結合）
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/issue_management_test" pnpm --filter backend test

# カバレッジ
npx vitest run --coverage
```

テスト対象: ドメイン層（純粋関数・単体テスト）、インフラ層（DB / MinIO 実結合テスト）、
プレゼンテーション層（`app.request()` + compositionRoot モック）。

詳細: [`docs/guides/testing.md`](./docs/guides/testing.md)

---

## ドキュメント目次

| ドキュメント | 内容 |
| ------------ | ---- |
| [`docs/guides/architecture/index.md`](./docs/guides/architecture/index.md) | 全体アーキテクチャ・コンテナ構成 |
| [`docs/guides/architecture/backend.md`](./docs/guides/architecture/backend.md) | バックエンド設計・依存方向・DI・CQRS |
| [`docs/guides/architecture/frontend.md`](./docs/guides/architecture/frontend.md) | フロントエンド設計・写真アップロードフロー |
| [`docs/guides/event-sourcing.md`](./docs/guides/event-sourcing.md) | イベントソーシング + CQRS の詳細 |
| [`docs/guides/blob-strategy.md`](./docs/guides/blob-strategy.md) | Blob ストレージ戦略・整合性設計 |
| [`docs/guides/future-considerations.md`](./docs/guides/future-considerations.md) | 将来拡張方針（クラウド・認証・大量データ） |
| [`docs/guides/development.md`](./docs/guides/development.md) | 開発環境セットアップ・運用ノウハウ |
| [`docs/guides/testing.md`](./docs/guides/testing.md) | テスト戦略・実行方法 |
| [`docs/guides/domain-model.md`](./docs/guides/domain-model.md) | ドメインモデル + ER 図 |
| [`docs/guides/api.md`](./docs/guides/api.md) | API 設計（全エンドポイント仕様） |
| [`docs/guides/design-workflow.md`](./docs/guides/design-workflow.md) | デザイン運用ルール（.pen ファイル） |

---

## 設計要求への回答

### 8.1 全体アーキテクチャ

以下の 1 枚に、本システムの主要構造を 4 つの図でまとめている。
(1) 全体構成 / (2) レイヤー依存方向 / (3) CQRS + イベントソーシングのフロー / (4) Blob 整合性シーケンス。
各図の詳細は該当セクション（8.1 / 8.3 / 8.4）で解説する。

![アーキテクチャ概要図](./docs/guides/architecture.png)

**レイヤー構成と依存方向**（上図 2）

- `domain` はどこにも依存しない（フレームワーク・DB・MinIO・APS を知らない）
- `infrastructure` は `domain` のリポジトリインターフェースを実装する（依存性逆転）
- `application` は `domain` のインターフェースにのみ依存し、具体実装を知らない

**全体構成**（上図 1）

Frontend は Hono RPC で Backend と型共有し、写真は Presigned URL で MinIO に直接アップロードする。
Backend は 2-legged OAuth で APS トークンを取得・キャッシュし、PostgreSQL にイベント + 読み取りモデルを永続化する。
`minio-cleanup` が 5 分間隔で `pending/` をスキャンし、10 分超過のファイルを削除する。

**コンテナ構成（docker-compose）**

| サービス      | イメージ           | 役割                      |
| ------------- | ------------------ | ------------------------- |
| frontend      | node:22-alpine     | Next.js App Router        |
| backend       | node:22-alpine     | Hono API サーバー         |
| db            | postgres:17-alpine | データ永続化              |
| minio         | minio/minio        | Blob ストレージ（S3互換） |
| minio-cleanup | minio/mc           | Orphan ファイル自動削除   |

**フレームワーク依存の隔離（DI）**

DI コンテナやデコレータを使わず、高階関数で依存を注入する。
各ユースケース（`application/useCases/*.ts`）は repository / service を引数に取るファクトリ関数として定義し、
`compositionRoot.ts` が repository / service を組み立てて個別に export、
ルート定義（`presentation/routes/*Routes.ts`）がそれらを import してユースケースを合成する。
テスト時は compositionRoot をモックに差し替える（詳細はバックエンド設計参照）。

**ユースケース指向の API**

REST の単一リソース CRUD ではなく、ユースケース単位でエンドポイントを切る
（例: `POST /issues/:id/correct`, `POST /issues/:id/review`, `POST /issues/:id/comments`,
`POST /issues/:id/photos/upload-url`, `PUT /issues/:id`）。
プレゼンテーション層は zod で入力を検証してユースケースに委譲するだけの薄い層になり、
ユースケースがビジネスの意図を直接表現する。
フロントエンドは Repository パターンの中でこれらを 1:1 に呼び出す。

**型共有（Hono RPC）**

backend の `AppType` を export し、frontend から import することで、
API のリクエスト / レスポンス型をビルド時に共有する。REST でありながら型安全な通信を実現する。

詳細: [`docs/guides/architecture/index.md`](./docs/guides/architecture/index.md) /
[`docs/guides/architecture/backend.md`](./docs/guides/architecture/backend.md) /
[`docs/guides/architecture/frontend.md`](./docs/guides/architecture/frontend.md)

---

### 8.2 ドメイン設計

**Issue の責務（集約）**

Issue は本システムの中心集約。施工現場での「何が・どこで・誰によって・どう変化したか」を
イベントとして保持する。`User` / `Project` はイベントソーシングの対象外（シンプルな CRUD）。

**状態遷移の実装場所**

```mermaid
stateDiagram-v2
  direction LR
  [*] --> open : 指摘登録
  open --> in_progress : 是正開始
  in_progress --> in_review : 是正完了
  in_review --> done : 承認
  in_review --> in_progress : 差し戻し
  done --> [*]

  classDef openStyle fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a
  classDef progressStyle fill:#fef3c7,stroke:#d97706,color:#78350f
  classDef reviewStyle fill:#ede9fe,stroke:#7c3aed,color:#4c1d95
  classDef doneStyle fill:#dcfce7,stroke:#15803d,color:#14532d

  class open openStyle
  class in_progress progressStyle
  class in_review reviewStyle
  class done doneStyle
```

遷移ルールは `domain/valueObjects/` に定義し、不正な遷移をドメイン層で防止する。

`in_review` ステータスを設けることで、是正作業の完了と管理者による承認を明確に分離した。
是正担当者が「完了した」と思っても管理者が「不十分」と判断した場合に差し戻し（In Review → In Progress）でき、
承認・差し戻しのやり取りを状態として記録できる。

**ビジネスルールの所在**

コマンド関数（`domain/entities/issue.ts`）がビジネスルールを検証し、
成功なら新しいドメインイベントを、失敗なら `DomainErrorDetail` を返す
（状態を変更せず、イベントを返すことで副作用を分離する）。

境界バリデーションは zod スキーマでドメイン仕様と対称化し、プレゼンテーション層で早期排除する。

詳細: [`docs/guides/architecture/backend.md`](./docs/guides/architecture/backend.md) /
[`docs/guides/event-sourcing.md`](./docs/guides/event-sourcing.md)

---

### 8.3 読み取りと書き込みの整理（CQRS）

フロー図は [上部アーキテクチャ概要図](#81-全体アーキテクチャ) の図 3 を参照。

**Command（書き込み）**: `IssueRepository.load` が EventStore からイベント列を再生して集約を復元し、
コマンド関数でビジネスルールを検証後、`EventStore.append` でイベントを追記。
`EventProjector` が読み取りモデル（`issues_read`）へ同期投影する。

**Query（読み取り）**: `IssueQueryService` が非正規化された `issues_read` から直接 DTO を取得する。
クエリ側はイベントや集約を経由しないため、読み取りパフォーマンスをコマンド側と独立して最適化できる。

**件数増加時の設計方針**

現在は**同期投影**（シンプルさ優先・整合性を保証）を採用している。

| 観点 | 現状の見立て |
| ---- | ------------ |
| 投影コスト | 想定規模（数百〜数千件）では書き込みレイテンシに対して無視できるレベル |
| `rehydrate` コスト | 1 指摘あたり数件〜数十件のイベントであり問題なし |
| 将来の移行 | `EventProjector` の実装を非同期に差し替えるだけで対応可能（インターフェース変更なし） |
| さらなる大規模化 | カーソルページング・インデックス最適化・Read モデルを Elasticsearch 等へ分離 |

詳細: [`docs/guides/event-sourcing.md`](./docs/guides/event-sourcing.md) /
[`docs/guides/future-considerations.md`](./docs/guides/future-considerations.md)

---

### 8.4 永続化戦略

**Repository の抽象化と DB 依存の隔離**

- `domain/repositories/` にインターフェース定義（EventStore / IssueRepository / IssueQueryService）
- `infrastructure/persistence/` に Drizzle ORM を使った具体実装
- `domain/` は SQL も Drizzle も知らない。DB の差し替えは `infrastructure/` 層のみ影響する

楽観的同時実行制御はイベントの `version` フィールドと `expectedVersion` チェックで実現する
（競合時は `ConcurrencyError` をスロー）。

**Blob 保存戦略 + DB と Blob の整合性**

シーケンスは [上部アーキテクチャ概要図](#81-全体アーキテクチャ) の図 4 を参照。

Frontend は Backend に Presigned PUT URL を要求し、`pending/{issueId}/{photoId}.{ext}` に直接 PUT する。
その後 confirm リクエストで Backend が DB にイベント（`PhotoAdded`）を永続化し、ファイルを
`confirmed/{issueId}/{phase}/{photoId}.{ext}` に移動する。ファイルデータがバックエンドを経由しないため
メモリ消費を抑制できる。

「MinIO アップロード成功・DB 登録失敗」による Orphan ファイルは、`minio-cleanup` コンテナ（常駐）が
5 分間隔で `pending/` をスキャンし、10 分以上経過したファイルを自動削除することで解消する。

Lifecycle Policy（最小単位が 1日でテスト困難）/ Outbox パターン（実装コスト大）との比較検討の結果、
開発環境での検証容易性を優先して `Cron + mc find` 方式を採用した。

詳細: [`docs/guides/event-sourcing.md`](./docs/guides/event-sourcing.md) /
[`docs/guides/blob-strategy.md`](./docs/guides/blob-strategy.md)

---

### 8.5 外部依存の隔離

**APS 依存の扱い**

- APS の 2-legged OAuth トークンはバックエンドで取得・キャッシュする
- Client Secret をフロントエンドに露出させない
- 実装は `infrastructure/external/` に閉じ、`domain/` / `application/` は APS を知らない
- 認証を追加しても APS トークン取得フローは変わらない（ユーザー認証と直交する）

**APS トークンキャッシュ戦略**（`infrastructure/external/apsClient.ts`）

| 戦略 | 実装内容 |
| ---- | -------- |
| **TTL バッファ** | `expires_in` の 60 秒前を有効期限に設定（`expiresAt = Date.now() + (expires_in - 60) * 1000`）。期限ギリギリのトークンが Viewer に渡るのを防ぐ |
| **重複取得の防止** | 進行中の `Promise` を `inFlightRequest` に保持し、同時リクエストは同一 `Promise` を返す。失効タイミングでも APS への認証リクエストは 1 回に抑制 |
| **スコープ** | `data:read viewables:read`（Viewer 表示に必要な権限のみ） |

**ストレージ依存の扱い**

`BlobStorage` インターフェースを `domain/services/` に定義し、
MinIO 実装（`createBlobStorage(client, bucket)`）を `infrastructure/` に置く。
compositionRoot で DI しているため、テスト時はモックに差し替え可能。

**隔離の効果**

`infrastructure/` 層の実装差し替えのみで外部サービスの移行が完結する。
`domain/` や `application/` は変更不要（依存性逆転の効果）。

詳細: [`docs/guides/architecture/backend.md`](./docs/guides/architecture/backend.md) /
[`docs/guides/blob-strategy.md`](./docs/guides/blob-strategy.md) /
[`docs/guides/future-considerations.md`](./docs/guides/future-considerations.md)

---

### 8.6 将来本番構成

**クラウドに上げるなら**

| ローカル      | クラウド移行先                                   |
| ------------- | ------------------------------------------------ |
| PostgreSQL    | Amazon RDS / Cloud SQL / Azure Database          |
| MinIO         | Amazon S3 / Google Cloud Storage / Azure Blob   |
| minio-cleanup | S3 Lifecycle Policy（1日単位で十分）            |
| Backend       | AWS Lambda / Google Cloud Run / Azure Container Apps |
| Frontend      | Vercel / Netlify / AWS Amplify / Cloudflare Pages |

MinIO → S3 は API 互換のため、エンドポイント変更のみで移行可能。

**Backend**

- Lambda / Cloud Run: コンテナをそのままデプロイ、自動スケールアウト。DB 接続数は RDS Proxy で緩和
- Cloudflare Workers: Hono はもともと Workers 向けに設計されコード変更はほぼ不要。ただし PostgreSQL への直接 TCP 接続は不可のため Cloudflare Hyperdrive が必要
- エンタープライズ領域では SLA・セキュリティ要件から AWS / GCP / Azure に統一する方が望ましい

**Frontend**

- Vercel: 手順が最も少なく、ISR / Edge Runtime にも対応
- AWS 統一の場合: Amplify（または CloudFront + S3 + Lambda@Edge）

**本プロジェクトにおける ISR / Edge Runtime の使い所**

| 機能 | 適用箇所 | メリット |
| ---- | -------- | -------- |
| **ISR** | 完了済み指摘の詳細画面（`/issues/[id]`） | Done 後は変更されないため CDN キャッシュの恩恵が大きい。`revalidateTag` で即時更新も可能 |
| **Edge Runtime** | 認証ミドルウェア（JWT 検証） | 未認証リクエストをエッジでブロックし、オリジンへの到達前に排除。レイテンシ最小化 |

判断基準の詳細: [`docs/guides/future-considerations.md`（セクション 6）](./docs/guides/future-considerations.md)

**認証を入れるなら**

現在は mock ユーザー（監督会社 / 協力会社）による切り替え方式で、認証基盤は未導入。

- Backend に Hono middleware で JWT 認証（Auth0 / Cognito / Firebase Auth 等）を追加
- ユーザー情報を Hono Context に注入し useCase に渡す
- `actorId` をリクエスト body から廃止し、middleware のセッションから取得する方式に変更
- Composer の状態×ロール判定を backend 側でも強制し、UI 迂回を防ぐ

**マルチユーザー対応するなら**

User / Project エンティティ、Issue への `projectId / reporterId / assigneeId` 組み込み、
楽観的同時実行制御（イベントの `version` フィールド）は実装済み。

未対応: RBAC（バックエンドでのロールベース権限チェック）、Blob パスへの projectId 追加
（IAM プレフィックス認可・一括削除・Lifecycle 配賦に有効）、JWT 統合。

**大量データ時の設計**

- **Query 最適化**: カーソルページング、インデックス（ステータス・プロジェクト・作成日時）、Read モデルを Elasticsearch 等へ分離（CQRS の EventProjector から更新）
- **Blob**: サムネイル自動生成（original / medium 800px / thumbnail 200px WebP）、CDN 配信
- **キャッシュ**: Backend に Redis 層を追加
- **フロントエンド**: 差分同期（`updated_at` ベース）→ IndexedDB キャッシュ → Web Worker フィルタリングの段階的導入。
  Repository パターンでデータ取得を抽象化しているため、IndexedDB への差し替えコストが低い（呼び出し側は変更不要）。

詳細: [`docs/guides/future-considerations.md`](./docs/guides/future-considerations.md)

---

### 実装を検討したいもの

**ミニマップ（3D 俯瞰ビュー）**

3D ビューアの隅に建物全体の俯瞰図を常時表示し、現在の視点位置を示す。
施工現場では「今どこを見ているか」を直感的に把握できることが重要で、特にモデルにズームインした状態では現在位置を見失いやすい。
APS Viewer の `getCamera()` でカメラ位置を取得し、俯瞰図上にインジケータを描画する。

**フロア絞り込み**

階層（1F〜5F）ごとに指摘とピンをフィルタリングし、選択階の断面ビューを表示する。
APS Viewer の Section Box で表示範囲をクリッピングし、指摘一覧も連動してフィルタする。

**リアルタイム性の強化**

現在は TanStack Query のポーリングで更新を検知しているが、WebSocket / SSE によるサーバープッシュに移行し、複数ユーザー間での即時反映を実現する。
指摘のステータス変更やコメント追加をリアルタイムに配信することで、監督会社と協力会社のやり取りのタイムラグを解消する。
イベントソーシングの EventProjector をフックポイントとして、イベント永続化時に接続中のクライアントへ通知を発行する設計が自然。

**通知**

ステータス変更（特に差し戻し・承認）や自分が担当する指摘へのコメント追加時に通知を送る。
まずはアプリ内通知（ヘッダーのベルアイコン + 未読バッジ）から始め、将来的にメール・Slack 連携に拡張する。
イベントソーシングの基盤があるため、通知対象の判定は既存のドメインイベントから導出できる。

**オフライン対応**

Service Worker + IndexedDB で指摘の閲覧・登録をオフラインでも可能にし、復帰時にバックエンドと差分同期する。
フロントエンドの Repository パターンにより、データソースを IndexedDB に差し替える影響範囲は Repository 層に閉じる（コンポーネント・フックは変更不要）。
写真アップロードは Background Sync API でキューイングし、接続回復後に自動送信する。

**音声入力**

施工現場では手袋やヘルメットを着用しているため、タッチ操作やキーボード入力がしづらい場面があると想定される。
Web Speech API を利用した音声入力で、指摘タイトルやコメントの入力負荷を下げられる可能性がある。
一方で現場によっては重機や工具の騒音が激しく、認識精度に影響が出ることも考えられる。
実際の利用環境でどの程度実用的かは現場の声を聴いて判断する必要があるが、認識結果のプレビュー・修正 UI を設け、手動入力との併用を前提とすることで騒音下でも補助的な入力手段として機能する形を目指したい。

**タッチ操作の最適化とフィードバック強化**

現場でのタブレット利用を想定すると、タップターゲットのサイズ拡大やボタン間の余白確保など、タッチ操作のしやすさを改善する余地がある。
また、指摘作成・ステータス変更・コメント投稿といったアクションの完了時にトースト通知やアニメーションで結果を明示し、画面上で何が起きたかを分かりやすくする。
具体的なサイズ感や配置、どの操作に確認ダイアログを挟むべきかといった判断は、実際に現場で使ってもらいながらフィードバックを反映して調整していく。
