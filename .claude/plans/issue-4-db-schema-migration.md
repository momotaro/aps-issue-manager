# Issue #4: DB スキーマ・マイグレーション（イベントソーシング + CQRS）

## 概要

Drizzle ORM を導入し、イベントソーシング + CQRS に対応した5テーブルを PostgreSQL 上に構築する。

## ID 形式の整理

- ドメイン層は `uuidv7` パッケージで UUID v7（標準 UUID 形式: 36文字）を生成
- Issue に「ULID CHAR(26)」と記載があるが、既存コードとの整合性を優先し PostgreSQL の `uuid` 型を使用
- `uuid` 型はハイフンなしで16バイト格納、インデックス効率が良い

## 実装タスク

### 1. Drizzle ORM セットアップ

**ファイル**: `backend/package.json`

- `drizzle-orm` + `postgres`（postgres.js ドライバ）を dependencies に追加
- `drizzle-kit` を devDependencies に追加
- `migrate` スクリプトを追加: `"migrate": "drizzle-kit migrate"`

### 2. DB 接続プール設定

**ファイル**: `backend/src/infrastructure/adapter/postgresql.ts`

- `postgres` (postgres.js) でコネクションプールを作成
- `DATABASE_URL` 環境変数から接続情報を取得
- `drizzle(client)` で Drizzle インスタンスを生成しエクスポート

### 3. テーブルスキーマ定義

**ファイル**: `backend/src/infrastructure/persistence/schema.ts`

5テーブルを Drizzle テーブル定義で作成:

#### users
| カラム | 型 | 備考 |
|--------|------|------|
| id | uuid PK | UUID v7 |
| name | varchar(255) | NOT NULL |
| email | varchar(255) | NOT NULL UNIQUE |
| role | varchar(20) | NOT NULL (admin/manager/member) |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

#### projects
| カラム | 型 | 備考 |
|--------|------|------|
| id | uuid PK | UUID v7 |
| name | varchar(255) | NOT NULL |
| description | text | NOT NULL |
| model_urn | varchar(500) | NOT NULL |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

#### issue_events（イベントストア）
| カラム | 型 | 備考 |
|--------|------|------|
| id | uuid PK | UUID v7 |
| issue_id | uuid | NOT NULL |
| type | varchar(50) | NOT NULL |
| payload | jsonb | NOT NULL |
| actor_id | uuid | NOT NULL |
| version | integer | NOT NULL |
| occurred_at | timestamptz | NOT NULL |
| UNIQUE(issue_id, version) | | 楽観的同時実行制御 |

#### issues_read（読み取りモデル）
| カラム | 型 | 備考 |
|--------|------|------|
| id | uuid PK | |
| project_id | uuid | NOT NULL |
| title | varchar(255) | NOT NULL |
| description | text | |
| status | varchar(20) | NOT NULL |
| category | varchar(30) | NOT NULL |
| position_type | varchar(20) | NOT NULL |
| position_data | jsonb | NOT NULL |
| reporter_id | uuid | NOT NULL |
| assignee_id | uuid | NULL |
| photo_count | integer | DEFAULT 0 |
| photos | jsonb | |
| version | integer | NOT NULL |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

インデックス: `project_id`, `status`, `category`, `assignee_id`

#### issue_snapshots（スナップショット）
| カラム | 型 | 備考 |
|--------|------|------|
| issue_id | uuid PK | |
| state | jsonb | NOT NULL |
| version | integer | NOT NULL |
| created_at | timestamptz | NOT NULL |

### 4. Drizzle 設定ファイル

**ファイル**: `backend/drizzle.config.ts`

- `dialect: "postgresql"`
- `schema: "./src/infrastructure/persistence/schema.ts"`
- `out: "./drizzle"` (マイグレーションファイル出力先)
- `dbCredentials.url: process.env.DATABASE_URL`

### 5. マイグレーション生成・実行

```bash
cd backend
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 6. Docker 自動マイグレーション

**ファイル**: `backend/Dockerfile`

CMD を変更: `pnpm install` → `drizzle-kit migrate` → `pnpm dev`

## 単体テスト計画

### schema.ts のテスト
- 各テーブル定義が正しいカラム・型・制約を持つことを検証
- `issue_events` の `UNIQUE(issue_id, version)` 制約の存在を検証
- `issues_read` のインデックスの存在を検証

### postgresql.ts のテスト
- DB 接続設定が `DATABASE_URL` を使用することを検証（環境変数モック）

## E2E テスト計画

- `docker compose up` でマイグレーションが自動実行されること
- 5テーブルが存在すること
- `issue_events` の UNIQUE 制約が実際に重複を拒否すること

## DB マイグレーション

- Drizzle Kit で自動生成（`drizzle-kit generate`）
- マイグレーション名: 自動生成

## ドキュメント更新

- `docs/guides/event-sourcing.md` § 9: スキーマ想定 → 「マイグレーションが正」に書き換え（ドキュメントの多重管理防止方針に従う）
