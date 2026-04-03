---
name: workflow:feature
description: |
  GitHub Issue に基づく feature 開発ワークフロー。Issue 把握 → 計画 → レビュー → 承認 → 実装 → 検証 → PR 作成を一貫して実行する。
  /workflow:feature、「feature を実装して」「Issue #XX を対応して」「#XX をやって」のようなリクエストで使用すること。
  Issue 番号が含まれるリクエストや、GitHub Issue への言及がある場合は必ずこのスキルを使用する。
---

# Feature 開発ワークフロー

GitHub Issue に基づいて feature を開発するための全手順。
各フェーズを順番に実行し、承認なしに実装を開始しないこと。

## Phase 1: Issue 把握

スクリプトを実行して Issue 情報を構造化取得する。

```bash
node .claude/skills/workflow-feature/scripts/fetch-issue.mjs <issue番号>
```

スクリプトの出力 JSON から以下を確認:
- `analysis.hasBackendTasks` / `analysis.hasFrontendTasks` — 作業範囲
- `analysis.definitionOfDone` — 動作確認の基準（Phase 8 で使用）
- `analysis.penFiles` — デザインファイルの有無

### Pencil MCP によるデザイン情報取得

`analysis.penFiles` に `.pen` ファイルがある場合のみ実行:

1. `get_editor_state` で現在のエディタ状態を確認
2. `open_document(penFilePath)` で .pen ファイルを開く
3. `batch_get` でデザインノードの情報を取得
4. `get_guidelines` でスタイルガイドを確認

`.pen` ファイルがない場合はスキップする。

## Phase 2: ブランチ作成

```bash
git checkout -b feat/<issue番号>-<slug>
```

- `slug` は Issue タイトルから英語 kebab-case で生成
- 例: Issue #42 "指摘一覧のフィルター機能" → `feat/42-issue-list-filter`

## Phase 3: 実装計画

`.claude/plans/` に計画ファイルを作成する。以下を含めること:

### 実装タスク
- Issue の `analysis.backendTasks` / `analysis.frontendTasks` を起点にする
- クリーンアーキテクチャの依存方向に沿った実装順序を決める
  - バックエンド: domain → application → infrastructure → presentation
  - フロントエンド: RSC → CC → hooks

### 単体テスト計画
- 各レイヤーで何をテストするか明記
- 正常系・異常系・境界値を考慮

### E2E テスト計画
- `analysis.definitionOfDone` の各項目に対応するテストシナリオ
- Playwright ベース

### DB マイグレーション（スキーマ変更がある場合のみ）
- `prisma/schema.prisma` の変更内容
- マイグレーション名

### ドキュメント更新
- 更新が必要な `docs/guides/` 配下のファイルを列挙
- 不要なら「なし」と明記

## Phase 4: 計画レビュー（毎回必須）

3つのサブエージェントを**並列で**起動してレビューする。

### 1. セキュリティレビュー

以下の観点で計画を評価:
- OWASP Top 10（SQL インジェクション、XSS、CSRF 等）
- APS Client Secret がフロントエンドに露出しないこと
- Blob ストレージのアクセス制御（`pending/` → `confirmed/` フロー）
- ユーザー入力のバリデーション（システム境界）

### 2. 設計方針レビュー

以下のドキュメントとの整合性を検証:
- `docs/guides/architecture.md` — アーキテクチャ設計
- `CLAUDE.md` の制約事項:
  - 依存方向: `presentation → application → domain ← infrastructure`
  - DI パターン: 高階関数（IoC コンテナ不可）
  - CQRS: 読み書き責務分離
  - domain 層: フレームワーク非依存
  - フロントエンド: UI (`xxx.tsx`) / ロジック (`xxx.hooks.tsx`) 分離
  - Blob パス: `confirmed/{issueId}/before/`, `confirmed/{issueId}/after/`

### 3. テスト計画レビュー

以下を検証:
- 単体テストのカバレッジ（正常系・異常系・境界値）
- E2E テストが `definitionOfDone` の全項目をカバーしているか
- テスト対象レイヤーの適切性（domain のテストに infrastructure が混入していないか等）

## Phase 5: 承認

レビュー結果をユーザーに提示し、明示的な承認を得る。

提示する内容:
- 3つのレビュー結果のサマリー
- 指摘事項があれば修正案
- 計画の最終版

**ユーザーの承認なしに Phase 6 に進まないこと。**

## Phase 6: 実装

計画に沿って実装する。

### バックエンド
- domain → application → infrastructure → presentation の順
- 高階関数 DI パターンを使用
- CQRS: Query は読み取り最適化、Command はバリデーション重視

### フロントエンド
- `xxx.tsx`（表示）と `xxx.hooks.tsx`（ロジック）を分離
- データ取得は Repository パターン + TanStack Query
- デザインは Phase 1 で取得した Pencil MCP の情報に従う
- UI 変更が必要な場合は .pen を先に更新 → コード修正（CLAUDE.md「デザイン（.pen）」参照）

### DB マイグレーション（該当する場合）
```bash
npx prisma migrate dev --name <migration_name>
npx prisma generate
```

### テスト
- 実装と同時に単体テストを書く
- 全実装完了後に E2E テストを書く

## Phase 7: 品質チェック

以下を順番に実行し、全て成功するまで修正を繰り返す:

```bash
pnpm test
pnpm lint
pnpm format
pnpm build
```

## Phase 8: 動作確認

`analysis.definitionOfDone` の各項目を基準に確認する。

### バックエンド API
- `curl` または `httpie` でエンドポイントを叩いて確認
- リクエスト/レスポンスが期待通りであることを検証

### フロントエンド UI
- Docker サービスが起動していることを確認: `docker compose up -d`
- Playwright MCP でブラウザ操作して確認
  - `localhost:3000` — フロントエンド
  - `localhost:4000` — バックエンド API
- 完了の定義の各項目を操作して確認

確認結果をユーザーに報告する。

## Phase 9: ドキュメント更新（必要な場合のみ）

Phase 3 の計画で特定したドキュメントを更新する。

| 変更内容 | 対象ファイル |
|---------|-------------|
| アーキテクチャ変更 | `docs/guides/architecture.md` |
| Blob 関連変更 | `docs/guides/blob-strategy.md` |
| 開発手順変更 | `docs/guides/development.md` |
| 将来拡張方針 | `docs/guides/future-considerations.md` |

## Phase 10: コードレビュー

`workflow:review:code` スキルを実行し、現在のブランチの差分コードをレビューする。

レビューで指摘があった場合は修正を完了してから Phase 11 に進むこと。

## Phase 11: Publish（Commit & PR & チケット更新）

`docs/templates/pr-feature.md` のフォーマットに従い、以下を決定する:

1. **コミットメッセージ** — `feat: <要約>\n\nCloses #<issue番号>\n\n<詳細>`
2. **PR タイトル** — `feat: <変更内容>`
3. **PR ボディ** — テンプレートに沿って作成し、一時ファイルに書き出す

決定後、publish スクリプトで一括実行する:

```bash
# PR ボディを一時ファイルに書き出す
cat <<'EOF' > /tmp/pr-body.md
## 概要
<変更内容の要約>

## 関連Issue
Closes #<issue番号>

## 変更内容
- <変更点1>
- <変更点2>

## 完了の定義
- [x] <definitionOfDone 項目1>
- [x] <definitionOfDone 項目2>

## テスト
- [x] pnpm test
- [x] pnpm lint
- [x] pnpm format
- [x] pnpm build

## スクリーンショット（該当する場合）
<スクリーンショット>
EOF

# コミット → プッシュ → PR作成 → Projectチケットを In review に移動
node .claude/skills/workflow-feature/scripts/publish.mjs <issue番号> \
  --commit-message "feat: <変更内容の要約>

Closes #<issue番号>

<詳細な変更内容>" \
  --pr-title "feat: <変更内容>" \
  --pr-body-file /tmp/pr-body.md
```
