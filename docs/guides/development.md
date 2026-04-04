# 開発ガイド

> コマンド・ポート一覧・ディレクトリ構成は `CLAUDE.md` を参照。
> 本ドキュメントでは環境構築の詳細と運用ノウハウを記述する。

## 1. 前提条件

- Node.js 22
- pnpm
- Docker / Docker Compose

## 2. アクセス URL

| サービス       | URL                          |
| -------------- | ---------------------------- |
| Frontend       | http://localhost:3000        |
| Backend        | http://localhost:4000        |
| Backend Health | http://localhost:4000/health |
| MinIO Console  | http://localhost:9001        |

## 3. Hot Reload

Docker 環境でもホットリロードに対応している:

- **Frontend**: `next dev` が HMR を提供。ソースディレクトリをボリュームマウント
- **Backend**: `tsx watch` がファイル変更を検知して自動再起動

## 4. Biome 設定

Biome v2 をルートに配置し、全ワークスペースを一括管理する。

- インデント: スペース（2幅）
- クォート: ダブルクォート
- import 自動整理: 有効
- 推奨ルール: 有効

## 5. Docker コンテナ詳細

### minio-cleanup

起動時にバケット `issues` を作成し、その後 Orphan ファイルの定期クリーンアップを実行する常駐コンテナ。

- バケット作成: `mc mb --ignore-existing local/issues`
- クリーンアップ: 5分間隔で `pending/` 内の10分以上経過したファイルを削除

### 環境変数

必須の環境変数が未設定の場合は明示的にエラーをスローする。空文字やデフォルト値へのサイレントフォールバックは禁止。設定ファイル（`drizzle.config.ts` 等）でも同様。

各サービスの `.env.sample` をコピーして `.env` を作成する:

```bash
cp frontend/.env.sample frontend/.env
cp backend/.env.sample backend/.env
```

- `frontend/.env` — 公開値のみ（`NEXT_PUBLIC_*`）
- `backend/.env` — DB, MinIO, APS シークレット含む
- `CORS_ALLOWED_ORIGINS` — CORS 許可オリジン（カンマ区切り、デフォルト: `http://localhost:3000`）

## 6. テスト実行

### テスト（単体 + 結合）

`pnpm --filter backend test` は `src/**/*.test.ts` を対象に、単体テストと結合テストを一括で実行する。
結合テストは PostgreSQL と MinIO に接続するため、事前に Docker を起動しておく必要がある。
Docker 未起動の環境では、このコマンドで単体テストだけを実行することはできない。

```bash
# 1. Docker 起動（DB + MinIO）
docker compose up -d

# 2. テスト用 DB のセットアップ（初回のみ）
docker compose exec db psql -U postgres -c "CREATE DATABASE issue_management_test"
DATABASE_URL="postgres://postgres:postgres@localhost:5432/issue_management_test" npx drizzle-kit push

# 3. テスト実行
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/issue_management_test" pnpm --filter backend test
```

結合テストは `fileParallelism: false` で逐次実行される（共有 DB の競合防止）。
