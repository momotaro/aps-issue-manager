# イベントソーシング + CQRS

> ステータス遷移・CQRS の概要は `architecture/backend.md` を参照。
> 本ドキュメントではイベントソーシングの具体的なデータフローと設計判断の根拠を記述する。
>
> **備考: 多重管理の防止方針**
> 実装が進むにつれ、コードやマイグレーションファイルが正（source of truth）となる情報は本ドキュメントから削除する。
> - **残す**: 採用理由、全体のデータフロー図、設計判断の比較・根拠（コードに分散すると見えなくなる情報）
> - **消す**: 型定義のコード例（TSDoc が正）、DB スキーマ（マイグレーションが正）、関連ファイル一覧（陳腐化する）

## 1. 概要

Issue 集約の状態変化をイベントソーシングで記録する。
現在の状態を直接更新するのではなく、「何が起きたか」をイベントとして追記し、
イベント列を再生して現在の状態を復元する。

User / Project はイベントソーシングの対象外（単純な CRUD）。

### 採用理由

| 理由 | 詳細 |
|------|------|
| 監査証跡 | 「誰が・いつ・何を変えたか」が自動的に記録される。施工現場の品質管理に必要 |
| 状態遷移の追跡 | ステータス変更の履歴がイベントとして残る。差し戻しの経緯も確認できる |
| 将来の拡張性 | イベントを起点に通知・集計・レポート等の機能を後から追加できる |

## 2. コマンド側（書き込み）のデータフロー

```
API リクエスト
  ↓
Presentation 層: リクエスト解析
  ↓
Application 層: ユースケース実行
  ├── IssueRepository.load(id)
  │     ├── EventStore.getEvents(id)    ← イベント列取得
  │     └── rehydrate(events)           ← 現在状態を復元
  ├── コマンド関数(issue, params)
  │     ├── ビジネスルール検証
  │     └── → Result<DomainEvent, Error> ← 新しいイベントを返す
  ├── IssueRepository.save(id, [event], expectedVersion)
  │     └── EventStore.append(id, [event], expectedVersion)
  └── EventProjector.project([event])   ← 読み取りモデルを更新
  ↓
API レスポンス
```

### コマンド関数の設計

コマンド関数は **状態を変更せず、イベントを返す**。

```typescript
// ビジネスルールを検証し、成功なら新しいイベント、失敗ならエラーを返す
const changeStatus = (
  issue: Issue,
  newStatus: IssueStatus,
  actorId: UserId,
): Result<IssueStatusChangedEvent, DomainErrorDetail> => {
  const result = validateTransition(issue.status, newStatus);
  if (!result.ok) return result;

  return ok({
    ...createEventMeta(issue.id, actorId, issue.version + 1),
    type: "IssueStatusChanged",
    payload: { from: issue.status, to: newStatus },
  });
};
```

## 3. クエリ側（読み取り）のデータフロー

```
API リクエスト
  ↓
Presentation 層: リクエスト解析
  ↓
Application 層: クエリ実行
  └── IssueQueryService.findAll(filters)
        └── 読み取りモデル（投影テーブル）から直接取得
  ↓
API レスポンス（DTO）
```

クエリ側は **イベントや集約を経由しない**。
非正規化された読み取りテーブルから直接データを取得する。
これにより、読み取りパフォーマンスをコマンド側と独立して最適化できる。

## 4. ドメインイベント

### イベント一覧

| イベント | 発生タイミング | ペイロード |
|---------|--------------|-----------|
| `IssueCreated` | 指摘の新規登録 | 初期フィールド（title, status, category, position 等） |
| `IssueTitleUpdated` | タイトル変更 | `title` |
| `IssueStatusChanged` | ステータス遷移 | `from`, `to` |
| `IssueCategoryChanged` | 種別変更 | `category` |
| `IssueAssigneeChanged` | 担当者変更 | `assigneeId` |
| `CommentAdded` | コメント追加（immutable）| `comment`（`commentId`, `body`, `actorId`, `attachments`, `createdAt`） |

### イベントの構造

すべてのイベントは共通メタデータ（`EventMeta`）を持つ。

```typescript
type EventMeta = {
  id: EventId;           // イベント自体の UUID v7
  issueId: IssueId;      // 対象の集約 ID
  occurredAt: Date;      // 発生日時（監査証跡・UI 表示用）
  actorId: UserId;       // 操作者
  version: number;       // 集約内の連番（順序保証・同時実行制御用）
};
```

`type` フィールドで TypeScript の判別共用体（discriminated union）として型絞り込みが可能。

### イベントの不変性

永続化されたイベントは変更しない。
スキーマ変更が必要な場合は、新しいイベント型（例: `IssueTitleUpdated_v2`）を追加する。

## 5. 状態復元

### applyEvent

1つのイベントを現在の状態に適用し、新しい状態を返す純粋関数。

```typescript
const applyEvent = (state: Issue | null, event: IssueDomainEvent): Issue
```

### rehydrate

イベント列全体を `reduce` で畳み込み、現在の状態を復元する。

```typescript
const rehydrate = (events: IssueDomainEvent[]): Issue | null =>
  events.reduce(applyEvent, null);
```

### rehydrateFromSnapshot

スナップショット + 差分イベントで復元する。全イベント再生を回避する最適化。

```typescript
const rehydrateFromSnapshot = (
  snapshot: Issue,
  events: IssueDomainEvent[],
): Issue => events.reduce(applyEvent, snapshot);
```

## 6. 楽観的同時実行制御

`version` フィールドで競合を検出する。

```
ユーザー A: load(id) → issue (version: 3)
ユーザー B: load(id) → issue (version: 3)

ユーザー A: save(id, [event], expectedVersion: 3) → 成功 (version: 4)
ユーザー B: save(id, [event], expectedVersion: 3) → ConcurrencyError
```

- `IssueCreated` は常に `version = 1`
- 以降のイベントは前の `version + 1`
- `EventStore.append` 時に `expectedVersion` と実際の最新 version を比較
- 不一致なら `ConcurrencyError` をスローし、呼び出し側でリトライまたはエラー応答

## 7. 読み取りモデルの投影

`EventProjector` がイベントを読み取りモデル（投影テーブル）に同期投影する。

```
EventStore.append(event)
  ↓（同一トランザクション）
EventProjector.project([event])
  ↓
読み取りテーブルを INSERT / UPDATE
```

### 同期投影を選択した理由

| 方式 | メリット | デメリット | 採用 |
|------|---------|-----------|------|
| 同期投影 | 常に整合。実装がシンプル | 書き込みレイテンシに投影コストが加算 | **採用** |
| 非同期投影（イベントバス） | 書き込みが高速 | 結果整合。インフラ（メッセージキュー）が必要 | - |

現在の規模（数百〜数千件の指摘）では同期投影で十分。
将来的にイベント数やユーザー数が増加した場合は、
`EventProjector` の実装を非同期に差し替えるだけで移行可能（インターフェースは同じ）。

## 8. スナップショット

イベント数が増加した集約の復元を高速化するためのキャッシュ機構。

```
通常:    EventStore → 全イベント再生 → Issue
最適化:  Snapshot(version: 50) + EventStore(version 51〜) → Issue
```

- `IssueRepository` がスナップショットの保存・取得を提供
- 現時点では未使用。イベント数が閾値（例: 100件）を超えた場合に導入を検討
- スナップショットが古くなっても、差分イベントで最新状態に追いつける

## 9. JSONB と Date 型の取り扱い

イベントペイロード（`issue_events.payload`）やスナップショット（`issue_snapshots.state`）、
読み取りモデル（`issues_read.photos`）は JSONB カラムに保存される。
JSONB シリアライズ時に `Date` 型は **ISO 8601 文字列に変換** されるため、
復元時に明示的なパースが必要。

### 規約

| 操作 | 方針 |
|------|------|
| **保存時** | `Date` フィールドは `toISOString()` で正規化して保存 |
| **復元時** | `new Date(stringValue)` でパースして `Date` に戻す |
| **対象フィールド** | `Photo.uploadedAt`、スナップショットの `createdAt` / `updatedAt` |

### 実装箇所

- `eventStoreImpl.ts` — `restorePayloadDates()`: イベントペイロード内の Photo.uploadedAt を復元
- `issueRepositoryImpl.ts` — `restorePhotoDates()` / `snapshotToJson()`: スナップショットの保存・復元
- `issueQueryServiceImpl.ts` — `restorePhotoDates()`: 読み取りモデルの photos を復元

**新たに Date 型のフィールドを JSONB 内に追加する場合は、上記の復元関数を必ず更新すること。**

## 10. DB スキーマ

スキーマ定義は Drizzle ORM のマイグレーションが正（source of truth）。

- **スキーマ定義**: `backend/src/infrastructure/persistence/schema.ts`
- **マイグレーション**: `backend/drizzle/`
- **テーブル**: `users`, `projects`, `issue_events`, `issues_read`, `issue_snapshots`

### 読み取りモデルの設計方針

- カラムの NULL 許容性はドメイン型（`IssueDetail` 等）に合わせる
- ドメインで `string` なら DB は `NOT NULL`、`string | null` なら NULL 許容
- コレクション型（`photos` 等）は `NOT NULL DEFAULT '[]'` で空配列を保証

## 11. 関連ファイル

| ファイル | 内容 |
|---------|------|
| `backend/src/domain/events/issueEvents.ts` | ドメインイベントの型定義 |
| `backend/src/domain/events/eventMeta.ts` | イベント共通メタデータ |
| `backend/src/domain/entities/issue.ts` | Issue 集約（applyEvent, rehydrate, コマンド関数） |
| `backend/src/domain/repositories/eventStore.ts` | EventStore インターフェース |
| `backend/src/domain/repositories/issueRepository.ts` | IssueRepository インターフェース |
| `backend/src/domain/repositories/issueQueryService.ts` | 読み取り側クエリインターフェース |
| `backend/src/domain/services/eventProjector.ts` | EventProjector インターフェース |
