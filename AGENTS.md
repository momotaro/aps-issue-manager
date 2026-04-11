## プロジェクト概要

施工現場向け「指摘管理ツール」。APS Viewer上の3Dモデルにピンを立て、指摘（Issue）を登録・管理する。

- 指摘に3D上の位置（部材dbId / 空間worldPosition）を紐づける
- 写真（是正前/是正後）を添付できる
- ステータス（Open / In Progress / In Review / Done）を管理できる
- 一覧から3D上の該当箇所に移動できる

## 技術スタック

### Frontend (`frontend/`)

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 + pencil.dev
- react-hook-form + zod（フォーム/バリデーション）
- TanStack Query + Repository パターン（データ取得）
- APS Viewer v7（3D表示）

### Backend (`backend/`)

- Hono + hono/rpc（フロントエンドと型共有）
- 関数型プログラミング + 高階関数DI
- クリーンアーキテクチャ（presentation / application / domain / infrastructure）
- イベントソーシング + CQRS（Issue 集約の状態変化をイベントで記録・読み書き責務分離）
- uuid v7 + base62（ID 生成: 内部は UUID v7、外部公開時は base62 エンコード）

### インフラ（Docker）

- PostgreSQL 17（データ永続化）
- MinIO（S3互換 Blob ストレージ）
- minio-cleanup（Orphanファイル自動削除: 10分TTL）

## monorepo 構成

pnpm workspaces。Biome v2 でルート一括管理。

```
test_prj/
├── frontend/           # :3000
├── backend/            # :4000
├── docker-compose.yml
├── biome.json
└── docs/guides/        # 設計ドキュメント
```

## コマンド

```bash
# 全サービス起動
docker compose up --build -d

# 個別起動（ローカル）
pnpm dev:frontend
pnpm dev:backend

# Lint / Format
pnpm lint
pnpm format

# ビルド
pnpm build

# テスト
pnpm --filter backend test
pnpm --filter backend test:watch

# カバレッジ
npx vitest run --coverage

# データ管理
pnpm -w data:seed      # ダミーデータ投入（128件、冪等）
pnpm -w data:clear     # 全データ削除
pnpm -w data:migrate   # DBマイグレーション実行
```

## ポート一覧

| サービス      | ポート |
| ------------- | ------ |
| Frontend      | 3000   |
| Backend       | 4000   |
| PostgreSQL    | 5432   |
| MinIO API     | 9000   |
| MinIO Console | 9001   |

## バックエンド ディレクトリ構成

```
backend/src/
├── index.ts                 # サーバー起動
├── compositionRoot.ts       # 依存の組み立て（DI）
├── presentation/routes/     # Hono ルート定義
├── application/useCases/    # ユースケース
├── domain/
│   ├── entities/            # エンティティ（Issue集約, User, Project）
│   ├── events/              # ドメインイベント（イベントソーシング）
│   ├── valueObjects/        # 値オブジェクト（Status, Position, Photo等）
│   ├── repositories/        # Repository インターフェース
│   └── services/            # ドメインサービス・エラー型
└── infrastructure/
    ├── persistence/         # DB実装
    └── external/            # APS, MinIO クライアント
```

依存方向: `presentation → application → domain ← infrastructure`

## フロントエンド設計規約

- UI と ロジックを分離: `xxx.tsx`（表示） / `xxx.hooks.tsx`（ロジック）
- データ取得は Repository パターンで抽象化

## 重要な制約事項

### APS

- 2-legged OAuth トークンはバックエンド側で取得・キャッシュ
- Client Secret をフロントエンドに露出させない
- APS 依存は `infrastructure/external/` に隔離

### Blob ストレージ

- アップロード時は `pending/` prefix → DB登録後に `confirmed/` へ移動
- `pending/` の10分超過ファイルは minio-cleanup が自動削除
- 写真パス: `confirmed/{issueId}/{commentId}/{photoId}.{ext}`

### クリーンアーキテクチャ

- `domain/` はフレームワーク非依存（Hono, DB, MinIO を知らない）
- `infrastructure/` は `domain/` の Repository インターフェースを実装（依存性逆転）
- DI は高階関数: `const useCase = (repo: Repository) => async (input) => { ... }`

### デザイン（.pen）

- .pen がデザインのソースオブトゥルース（正）。コードはデザインの実装
- UI 変更は必ず .pen を先に更新 → その後コードを修正（逆流禁止）
- .pen はページ単位（`page.pen`）で作成。コンポーネントごとの .pen は作らない
- .pen 内のノード名は実装コンポーネント名に合わせる
- 詳細: `docs/guides/design-workflow.md`

### Docker

- コンテナ内の pnpm store は `/tmp/.pnpm-store` に配置（ホスト汚染防止）
- `CI=true` 環境変数で pnpm の対話プロンプトを抑制

## ワークフロー

- 作業のキリが良いタイミング（機能実装完了、リファクタリング後など）で、開発プロセスやワークフローの改善点があれば提案する
- 例: テスト戦略、CI/CD、コード品質、開発体験の向上など

## ドキュメント

| ファイル                               | 内容                |
| -------------------------------------- | ------------------- |
| `docs/guides/architecture/index.md`    | アーキテクチャ設計          |
| `docs/guides/architecture/frontend.md` | フロントエンド設計          |
| `docs/guides/architecture/backend.md`  | バックエンド設計            |
| `docs/guides/event-sourcing.md`        | イベントソーシング + CQRS   |
| `docs/guides/blob-strategy.md`         | Blob ストレージ戦略         |
| `docs/guides/testing.md`              | テスト戦略                  |
| `docs/guides/development.md`          | 開発ガイド                  |
| `docs/guides/design-workflow.md`      | デザイン運用ルール          |
| `docs/guides/future-considerations.md` | 将来拡張方針                |

<!-- aegis:start -->
## Aegis Process Enforcement

You MUST consult Aegis for every coding-related interaction — implementation tasks AND questions about architecture, patterns, or conventions. No exceptions.

### When Writing Code

1. **Create a Plan** — Before touching any file, articulate what you intend to do.
2. **Consult Aegis** — Call `aegis_compile_context` with:
   - `target_files`: the files you plan to edit
   - `plan`: your natural-language plan (optional but recommended)
   - `command`: the type of operation (scaffold, refactor, review, etc.)
3. **Read and follow** the returned architecture guidelines.
   - `delivery: "inline"` — content is included; read it directly.
   - `delivery: "deferred"` — content is NOT included. You MUST Read the file via `source_path` before proceeding. Prioritize by `relevance` score (high first); skip only documents with very low relevance (< 0.25) unless specifically needed.
   - `delivery: "omitted"` — excluded by budget or policy. Increase `max_inline_bytes` or use `content_mode: "always"` if needed.
4. **Self-Review** — After writing code, check your implementation against the returned guidelines.
5. **Report Compile Misses** — If Aegis failed to provide a needed guideline:
   ```
   aegis_observe({
     event_type: "compile_miss",
     related_compile_id: "<from step 2>",
     related_snapshot_id: "<from step 2>",
     payload: {
       target_files: ["<files>"],
       review_comment: "<what was missing or insufficient>",
       target_doc_id: "<optional: base.documents[*].doc_id whose content was insufficient>",
       missing_doc: "<optional: doc_id that should have been returned but was not>"
     }
   })
   ```
   - `target_doc_id`: A doc_id from the **base.documents** section of the compile result whose content was insufficient. Do NOT use expanded or template doc_ids.
   - `missing_doc`: A doc_id that should have been included in the compile result but was absent.
   - If neither can be identified, `review_comment` alone is sufficient.

### When Answering Questions

If the user asks about architecture, patterns, conventions, or how to write code — even without requesting implementation:

1. **Identify representative files** — Find 1–3 real file paths in the codebase that are relevant to the question (e.g. `modules/Member/Application/Member/UpdateMemberInteractor.php`). Use directory listings or search if needed. Do NOT guess paths or use directories. **Do NOT read the files** — Aegis already has the relevant guidelines; reading files wastes tokens.
2. **Consult Aegis** — Call `aegis_compile_context` with:
   - `target_files`: the real file paths from step 1
   - `plan`: the user's question in natural language
   - `command`: `"review"`
3. **Answer using Aegis context** — Base your answer on the guidelines returned by Aegis, supplemented by your own knowledge. Cite specific guidelines when relevant. When documents include a `relevance` score, prioritize high-scoring documents and skim or skip low-scoring ones.

### When Knowledge Base Is Empty

If `aegis_compile_context` returns no documents, the knowledge base has not been populated yet.
Ask the user to run initial setup using the **admin surface** with `aegis_import_doc` to add architecture documents with `edge_hints`.

### Rules

- NEVER skip the Aegis consultation step — for both implementation and questions.
- NEVER ignore guidelines returned by Aegis.
- The compile_id and snapshot_id from the consultation are required for observation reporting.
<!-- aegis:end -->
