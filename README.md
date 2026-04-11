# 指摘管理ツール

施工現場向けの BIM 連携指摘管理アプリケーション。APS Viewer 上の 3D モデルにピンを立て、
指摘（Issue）の登録・写真添付・ステータス管理・位置への再移動を一元的に行う。

- 指摘に 3D 上の位置（部材 `dbId` / 空間 `worldPosition`）を紐づける
- 写真（是正前 / 是正後）を複数枚添付できる
- ステータス（Open / In Progress / In Review / Done）を遷移管理する
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

## ディレクトリ構成（抜粋）

```
test_prj/
├── frontend/                    # Next.js App Router（:3000）
│   └── src/
│       ├── app/                 # ページ（App Router）
│       ├── components/          # UI コンポーネント（*.tsx）+ ロジック（*.hooks.ts）
│       └── repositories/        # データ取得の抽象化（TanStack Query）
├── backend/                     # Hono API サーバー（:4000）
│   └── src/
│       ├── presentation/routes/ # Hono ルート定義
│       ├── application/useCases/# ユースケース（高階関数 DI）
│       ├── domain/
│       │   ├── entities/        # Issue 集約（applyEvent, rehydrate, コマンド関数）
│       │   ├── events/          # ドメインイベント型定義
│       │   ├── valueObjects/    # Status, Position, Photo（遷移ルール含む）
│       │   ├── repositories/    # Repository / QueryService インターフェース
│       │   └── services/        # BlobStorage インターフェース・エラー型
│       ├── infrastructure/
│       │   ├── persistence/     # Drizzle ORM + PostgreSQL 実装
│       │   └── external/        # APS・MinIO クライアント実装
│       └── compositionRoot.ts   # 依存の組み立て（DI ルート）
├── docker-compose.yml
├── biome.json                   # Lint / Format（全ワークスペース一括）
└── docs/guides/                 # 設計ドキュメント
```

依存方向: `presentation → application → domain ← infrastructure`

---

## テスト

```bash
# Docker 起動（結合テストに必要）
docker compose up -d

# テスト用 DB セットアップ（初回のみ）
docker compose exec db psql -U postgres -c "CREATE DATABASE issue_management_test"
DATABASE_URL="postgres://postgres:postgres@localhost:5432/issue_management_test" npx drizzle-kit push --config=backend/drizzle.config.ts

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

**レイヤー構成と依存方向**

```mermaid
graph LR
  P["Presentation<br/>Hono ルート"] --> A["Application<br/>ユースケース"]
  A --> D["Domain<br/>エンティティ・値オブジェクト<br/>Repository IF"]
  I["Infrastructure<br/>Drizzle ORM / MinIO / APS"] -->|"実装"| D

  style P fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a
  style A fill:#fef9c3,stroke:#ca8a04,color:#713f12
  style D fill:#dcfce7,stroke:#15803d,color:#14532d
  style I fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
```

- `domain` はどこにも依存しない（フレームワーク・DB・MinIO・APS を知らない）
- `infrastructure` は `domain` のリポジトリインターフェースを実装する（依存性逆転）
- `application` は `domain` のインターフェースにのみ依存し、具体実装を知らない

**全体構成図**

```mermaid
graph TB
  subgraph Client["クライアント"]
    Browser["ブラウザ"]
  end

  subgraph App["アプリケーション"]
    FE["Frontend<br/>Next.js :3000"]
    BE["Backend<br/>Hono/RPC :4000"]
  end

  subgraph Infra["インフラ（Docker）"]
    DB["PostgreSQL :5432"]
    MinIO["MinIO :9000/9001"]
    Cleanup["minio-cleanup<br/>Orphan 自動削除"]
  end

  External["APS API<br/>Autodesk Platform Services"]

  Browser -->|"HTTP"| FE
  FE -->|"Hono RPC（型共有）"| BE
  Browser -->|"Presigned PUT<br/>写真直接アップロード"| MinIO
  BE --> DB
  BE --> MinIO
  BE -->|"2-legged OAuth"| External
  Cleanup -->|"5分間隔スキャン<br/>10分超過ファイル削除"| MinIO

  style Browser fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style FE fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a
  style BE fill:#dcfce7,stroke:#15803d,color:#14532d
  style DB fill:#fef9c3,stroke:#ca8a04,color:#713f12
  style MinIO fill:#fef9c3,stroke:#ca8a04,color:#713f12
  style Cleanup fill:#fef9c3,stroke:#ca8a04,color:#713f12
  style External fill:#ede9fe,stroke:#7c3aed,color:#4c1d95
```

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
`init` 関数が依存を受け取りユースケース群を返す。ワイヤリングを `compositionRoot.ts` に集約し、
テスト時はモックを差し替える（詳細はバックエンド設計参照）。

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

**Command（書き込み）**

```
IssueRepository.load(id)        ← EventStore からイベント列を再生（rehydrate）
  → コマンド関数（ビジネスルール検証）
  → EventStore.append(event)    ← イベント追記
  → EventProjector.project()   ← 読み取りモデルへ同期投影
```

**Query（読み取り）**

```
IssueQueryService.findAll(filters)
  → 読み取りテーブル（issues_read）から直接 DTO を取得
```

クエリ側はイベントや集約を経由しない。非正規化された読み取りテーブルから直接取得することで、
読み取りパフォーマンスをコマンド側と独立して最適化できる。

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

**Blob 保存戦略**

```
1. Frontend → Backend: Presigned PUT URL を要求（fileName, phase）
2. Backend: pending/{issueId}/{photoId}.{ext} への Presigned URL を発行
3. Frontend → MinIO: ファイルを直接 PUT（バックエンドを経由しない）
4. Frontend → Backend: confirm リクエスト
5. Backend: DB にイベント（PhotoAdded）を永続化
6. Backend: MinIO でファイルを confirmed/{issueId}/{phase}/{photoId}.{ext} に移動
```

Presigned URL 方式により、ファイルデータがバックエンドを経由せず、メモリ消費を抑制する。

**DB と Blob の整合性戦略**

「MinIO アップロード成功・DB 登録失敗」によって Orphan ファイルが `pending/` に残る問題を、
`minio-cleanup` コンテナ（常駐）が 5分間隔で `pending/` をスキャンし、
10分以上経過したファイルを自動削除することで解消する。

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

| 機能 | 適用箇所 | 方針 |
| ---- | -------- | ---- |
| **ISR** | 完了済み指摘の詳細画面（`/issues/[id]`） | Done 遷移時に `revalidateTag` で即時更新。Open / In Progress は TanStack Query によるクライアントフェッチが適切（リアルタイム性が必要） |
| **Edge Runtime** | 認証ミドルウェア（JWT 検証） | Next.js Middleware（Edge）でエッジブロック。APS トークン取得・キャッシュはバックエンド側の責務のため Edge には含めない |

**認証を入れるなら**

- Hono middleware で JWT 認証（Auth0 / Cognito / Firebase Auth 等）を追加
- ユーザー情報を Hono Context に注入し useCase に渡す（既存の useCase シグネチャへの影響を最小化）
- Issue への `createdBy` / `assignedTo` 付与も同時に対応

**マルチユーザー対応するなら**

実装済み: User エンティティ（admin / manager / member ロール）、Project エンティティ（modelUrn）、
Issue への `projectId / reporterId / assigneeId` の組み込み、イベントソーシングによる楽観的同時実行制御。

未実装（将来対応）: RBAC、Blob パスへのプロジェクト ID 追加（`confirmed/{projectId}/{issueId}/`）、JWT 統合。

**大量データ時の設計**

- **Query 最適化**: カーソルページング、インデックス（ステータス・プロジェクト・作成日時）、
  Read モデルを Elasticsearch 等へ分離（CQRS の EventProjector から更新）
- **Blob**: サムネイル自動生成（original / medium 800px / thumbnail 200px WebP）、CDN 配信
- **キャッシュ**: Backend に Redis 層を追加
- **フロントエンド**: 差分同期（`updated_at` ベース）→ IndexedDB キャッシュ → Web Worker フィルタリングの段階的導入。フロントエンドは Repository パターンでデータ取得を抽象化しているため、IndexedDB をデータソースとする実装に差し替えるコストが低い（呼び出し側のコンポーネント・フックは変更不要）。

詳細: [`docs/guides/future-considerations.md`](./docs/guides/future-considerations.md)
