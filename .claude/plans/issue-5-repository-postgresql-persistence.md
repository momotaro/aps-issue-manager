# Issue #5: Repository 実装（PostgreSQL 永続化）

## 実装タスク

依存方向（domain → application → infrastructure）に沿い、以下の順序で実装する。

### 1. EventStore 実装 (`infrastructure/persistence/eventStoreImpl.ts`)
- `issue_events` テーブルへの append（バッチ INSERT）
- 楽観的同時実行制御: `UNIQUE(issue_id, version)` 違反時に `ConcurrencyError` をスロー
- `getEvents`: version 昇順で取得、`afterVersion` オプション対応
- Drizzle ORM のトランザクション対応（外部から tx を受け取れる設計）

### 2. EventProjector 実装 (`infrastructure/persistence/eventProjectorImpl.ts`)
- `IssueCreated` → `issues_read` に INSERT
- その他イベント → 該当行を UPDATE（各イベント型ごとに更新フィールドを切り替え）
- トランザクション対応（EventStore.append と同一 tx で実行）

### 3. IssueRepository 実装 (`infrastructure/persistence/issueRepositoryImpl.ts`)
- `load`: スナップショット取得 → 差分イベント取得 → rehydrate/rehydrateFromSnapshot
- `save`: EventStore.append + EventProjector.project を同一トランザクションで実行
- `saveSnapshot`: `issue_snapshots` に UPSERT
- `getSnapshot`: `issue_snapshots` から取得 → Issue 型に復元

### 4. IssueQueryService 実装 (`infrastructure/persistence/issueQueryServiceImpl.ts`)
- `findById`: `issues_read` + users JOIN で reporterName/assigneeName を取得
- `findAll`: フィルタ条件（projectId, status, category, assigneeId）を動的 AND 構築、updatedAt DESC
- `getEventHistory`: `issue_events` から version 昇順取得（EventStore.getEvents を再利用）

### 5. UserRepository 実装 (`infrastructure/persistence/userRepositoryImpl.ts`)
- `findById`: `users` テーブルから取得 → `reconstructUser`
- `findAll`: 全件取得
- `save`: UPSERT（`onConflictDoUpdate` on PK）
- `findByEmail`: email で検索

### 6. ProjectRepository 実装 (`infrastructure/persistence/projectRepositoryImpl.ts`)
- `findById`: `projects` テーブルから取得 → `reconstructProject`
- `findAll`: 全件取得
- `save`: UPSERT（`onConflictDoUpdate` on PK）

### 7. BlobStorage 実装 (`infrastructure/external/blobStorageImpl.ts`)
- MinIO（S3互換）クライアント（`@aws-sdk/client-s3`）を使用
- `uploadPending`: `pending/{issueId}/{photoId}.{ext}` に PutObject
- `confirmPending`: pending → confirmed にコピー＋旧オブジェクト削除
- `deleteByIssue`: `confirmed/{issueId}/` 配下を ListObjects → DeleteObjects

### 8. CompositionRoot (`compositionRoot.ts`)
- 高階関数 DI で全 Repository / Service の具体実装を注入
- db インスタンスを共有して各実装に渡す

## テスト計画

テストは実装ファイルと同階層に配置（コロケーション）。

### テスト戦略

| レベル | 対象 | 方針 |
|--------|------|------|
| 単体テスト | 純粋なロジック（イベント→DB行のマッピング、フィルタ条件構築など） | モック不要、高速 |
| 結合テスト | Repository 実装 × 実 DB / MinIO | Docker コンテナに対して実際に read/write |

Repository 層は DB/MinIO と直接やり取りするため、主軸は結合テスト。
純粋なマッピングロジックを切り出せる場合のみ単体テストも書く。

### テスト基盤
- `docker compose up -d` で PostgreSQL + MinIO を起動した状態で実行
- vitest の `beforeAll` でテーブルクリーンアップ、`afterAll` で接続クローズ
- テスト用ヘルパー: DB 接続の共有、テストデータファクトリ

### eventStoreImpl.test.ts（結合）
- **正常系**: イベント追記・取得（version 昇順）、afterVersion フィルタ、複数イベントのバッチ追記
- **異常系**: version 競合時に ConcurrencyError スロー
- **境界値**: 存在しない集約の getEvents → 空配列、expectedVersion=0 で新規集約

### eventProjectorImpl.test.ts（結合）
- **正常系**: IssueCreated で INSERT 確認、各更新イベント（Title/Description/Status/Category/Assignee/PhotoAdded/PhotoRemoved）で正しいフィールドが UPDATE
- **境界値**: 写真追加で photoCount インクリメント、写真削除でデクリメント

### issueRepositoryImpl.test.ts（結合）
- **正常系**: save → load のラウンドトリップ（全フィールドの一致確認）、スナップショット保存 → スナップショット + 差分イベントでの復元
- **異常系**: 存在しない ID → null、version 競合で ConcurrencyError
- **境界値**: スナップショットなしの load（全イベント再生）

### issueQueryServiceImpl.test.ts（結合）
- **正常系**: findById で詳細取得（reporterName/assigneeName 含む）、findAll でフィルタなし全件、各単独フィルタ、複合フィルタ
- **異常系**: 存在しない ID → null
- **境界値**: ソート順（updatedAt DESC）、フィルタ結果 0 件 → 空配列

### userRepositoryImpl.test.ts（結合）
- **正常系**: save → findById、findAll（複数件）、findByEmail、upsert（既存ユーザーの更新）
- **異常系**: 存在しない ID → null、存在しない email → null

### projectRepositoryImpl.test.ts（結合）
- **正常系**: save → findById、findAll（複数件）、upsert（既存プロジェクトの更新）
- **異常系**: 存在しない ID → null

### blobStorageImpl.test.ts（結合）
- **正常系**: uploadPending でオブジェクト作成確認、confirmPending で pending→confirmed 移動（パス更新）、deleteByIssue で一括削除
- **異常系**: 存在しないオブジェクトの削除（エラーなし）

## E2E テスト計画

本 Issue は infrastructure 層のみ（API エンドポイントなし）のため、E2E テストは不要。
API ルート実装（後続 Issue）で E2E を追加する。

## DB マイグレーション

なし（#4 で作成済み）

## ドキュメント更新

| 対象ファイル | 更新内容 |
|-------------|---------|
| `docs/guides/testing.md` | テスト戦略にインフラ層の結合テスト方針を追記（テスト基盤、Docker 前提、テストヘルパー構成） |
| `docs/guides/development.md` | テスト実行手順に結合テストの前提条件（Docker 起動）を追記 |
