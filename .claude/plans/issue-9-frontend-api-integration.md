# Issue #9: フロントエンド API 連携（モック → バックエンド切り替え）

## 概要

フロントエンドのモックデータを hono/rpc + TanStack Query ベースの API 連携に置き換える。

## 実装順序

### 1. インフラ層（API クライアント + プロバイダー）

- `frontend` に `hono` をインストール
- `frontend/src/lib/api-client.ts` — `hc<AppType>()` で型安全な API クライアント生成
  - `NEXT_PUBLIC_API_URL` 環境変数からベース URL を取得
- `frontend/src/app/providers.tsx` — `QueryClientProvider` を "use client" コンポーネントとして作成
- `frontend/src/app/layout.tsx` — `<Providers>` で children をラップ

### 2. Repository 層（高階関数 DI パターン）

- `frontend/src/repositories/issue-repository.ts`
  - 高階関数パターンで API クライアントを DI 注入（テスト時にモック差し替え可能）
  - `createIssueRepository(client)` → Repository オブジェクトを返す
  - メソッド:
    - `getIssues(filters?)` → `GET /api/issues`
    - `getIssueDetail(id)` → `GET /api/issues/:id`
    - `createIssue(input)` → `POST /api/issues`
    - `changeIssueStatus(id, status, actorId)` → `POST /api/issues/:id/status`
  - デフォルトエクスポートで `api-client.ts` のクライアントを注入済みインスタンスも提供

### 3. 型定義の同期

- `frontend/src/app/viewer/types.ts`:
  - `IssueStatus` に `"in_review"` 追加（3状態 → 4状態）
  - `IssueCategory` 型追加（`quality_defect` | `safety_hazard` | `construction_defect` | `design_change`）
  - `IssuePin` を API レスポンス型に合わせて拡張（`category` フィールド追加）
  - hono/rpc の `InferResponseType` で API レスポンス型を導出し、UI 固有の型のみ手書き
- `frontend/src/app/viewer/issue-pins.tsx`:
  - `in_review` ステータスの色（blue: `bg-blue-500`）追加

### 4. カスタムフック（TanStack Query）

- `frontend/src/app/viewer/issues-state.hooks.ts` を完全書き換え:
  - `useIssues()` — `useQuery` + issueRepository.getIssues
  - `useCreateIssue()` — `useMutation` + `queryClient.invalidateQueries`（楽観的更新は見送り）
  - `useChangeIssueStatus()` — `useMutation` + `queryClient.invalidateQueries`
- `frontend/src/app/viewer/aps-viewer.hooks.ts`:
  - APS トークン取得を TanStack Query の `useQuery` でラップ（リトライ・キャッシュの恩恵）

### 5. UI 更新

- `frontend/src/app/viewer/issue-form.tsx`:
  - zod スキーマに `category` を必須フィールドとして追加
  - カテゴリドロップダウン UI 追加:
    - `quality_defect` — 品質不良
    - `safety_hazard` — 安全不備
    - `construction_defect` — 施工不備
    - `design_change` — 設計変更
  - `onSubmit` を `useCreateIssue` ミューテーションに接続
  - ステータスに `in_review`（レビュー中）を追加
- `frontend/src/app/viewer/page.tsx`:
  - mock-issues 依存を除去
  - `useIssues()` から取得したデータを使用
  - ローディング・エラー状態のハンドリング
- `frontend/src/app/viewer/mock-issues.ts` を削除

### 6. 品質チェック

- `pnpm lint`
- `pnpm format`
- `pnpm build`

## テスト計画

### 単体テスト（今回は見送り）
- テストライブラリ（`@testing-library/react`, `jsdom` 環境）の導入が必要
- 別 Issue で対応予定

### E2E テスト（将来）
- 指摘一覧が API から表示される
- 指摘登録フォームで作成 → 一覧に反映
- ステータス変更 → ピン色が変わる

## DB マイグレーション
なし

## ドキュメント更新
- `docs/guides/architecture/frontend.md` — Repository パターンの具体例を追記

## レビューで採用した修正点
1. Repository は API クライアントを引数で受け取る高階関数パターンに（DI 方針準拠）
2. 型定義は hono/rpc の `InferResponseType` を活用、UI 固有の型のみ手書き
3. 楽観的更新は見送り、`queryClient.invalidateQueries` で対応（シンプルさ優先）
4. ファイルパスに `frontend/` プレフィックスを明記
