# テスト戦略

> コマンド一覧は `CLAUDE.md` を参照。
> 本ドキュメントでは単体テストの方針・構成・書き方を記述する。

## 1. 概要

テストフレームワークに Vitest を使用する。
現時点ではバックエンドのドメイン層の単体テストのみ対象とする。

## 2. テスト構成

### ファイル配置

テストファイルは実装ファイルと同じディレクトリにコロケーションする。
`__tests__/` ディレクトリは使用しない。

```
backend/src/domain/
├── entities/
│   ├── issue.ts
│   └── issue.test.ts        # ← 同階層に配置
├── valueObjects/
│   ├── issueStatus.ts
│   ├── issueStatus.test.ts
│   ├── brandedId.ts
│   ├── brandedId.test.ts
│   ├── photo.ts
│   ├── photo.test.ts
│   ├── position.ts
│   └── position.test.ts
```

### 命名規則

| 対象 | ファイル名 |
|------|-----------|
| 実装 | `foo.ts` |
| テスト | `foo.test.ts` |

### Vitest 設定

```typescript
// backend/vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

## 3. コマンド

```bash
# 全テスト実行
pnpm --filter backend test

# ウォッチモード
pnpm --filter backend test:watch

# カバレッジ付き
npx vitest run --coverage
```

## 4. テスト対象と方針

### ドメイン層（`domain/`）

ドメイン層はフレームワーク非依存の純粋関数で構成されるため、
モック不要で高速にテストできる。

| 対象 | テスト内容 |
|------|-----------|
| 値オブジェクト | 生成・バリデーション・型ガード |
| 状態遷移マシン | 許可/拒否の境界値、全遷移パスの網羅 |
| Issue 集約 | コマンド関数の成功/失敗、`applyEvent` による状態適用、`rehydrate` によるイベント列からの復元 |
| Branded ID | 生成の一意性、パース関数の等価性 |

### インフラストラクチャ層（`infrastructure/`）— 結合テスト

Repository / Service 実装は DB・MinIO と直接やり取りするため、結合テストで検証する。
`docker compose up -d` で PostgreSQL + MinIO を起動した状態で実行する。

| 対象 | テスト内容 |
|------|-----------|
| EventStore | イベント追記・取得、楽観的同時実行制御（ConcurrencyError） |
| EventProjector | IssueCreated の INSERT、各更新イベントの UPDATE |
| IssueRepository | save → load のラウンドトリップ、スナップショット復元 |
| IssueQueryService | フィルタ付きクエリ、ソート順、イベント履歴 |
| UserRepository | CRUD + findByEmail、upsert |
| ProjectRepository | CRUD、upsert |
| BlobStorage | Presigned URL 生成、pending → confirmed ライフサイクル、チャンク一括削除、deletePhoto の confirmed/ パス検証 |

#### テスト基盤

- テストヘルパー: `infrastructure/persistence/testHelper.ts`（DB 接続管理 + テーブルクリア）
- テストフィクスチャ: `infrastructure/persistence/testFixtures.ts`（ドメインオブジェクトファクトリ）
- `beforeEach` でテーブルをクリアし、テスト間の独立性を保証
- `afterAll` で DB 接続をクローズ
- `fileParallelism: false` で全テストファイルを逐次実行（共有 DB の競合防止）

#### 結合テストの注意事項

- **`vi.useFakeTimers()` は使用禁止**: fake timers は `setTimeout` / `setInterval` を偽装するため、DB ドライバ（postgres.js）や MinIO クライアント（minio パッケージ）の内部タイマーがハングし、テストがタイムアウトする。時刻差が必要なテストでは `setTimeout` による sleep で対応する

### プレゼンテーション層（`presentation/`）— ルートテスト

Hono の `app.request()` を使い、DB 接続なしでルートの振る舞いをテストする。
`vi.mock("../../compositionRoot.js")` で Repository をモックに差し替える。

| 対象 | テスト内容 |
|------|-----------|
| ルートハンドラ | 正常系のステータスコード（200/201）、404、バリデーション 400 |
| エラーハンドリング | `mapResultErrorToStatus` のコード→ステータスマッピング |
| レスポンス形式 | エラーエンベロープ `{ error: { code, message } }` の統一 |

ビジネスロジックの検証はドメイン層・ユースケース層のテストに委ね、
ルートテストでは HTTP 契約（ステータスコード・レスポンス形式）の固定化に集中する。

### フロントエンド層

カスタムフックとユーティリティ関数を対象とする。

| 対象 | テスト内容 |
|------|-----------|
| ファイルバリデーション | MIME チェック（`image/*`）、サイズ制限（10MB）、境界値（0B / ちょうど10MB） |
| アップロードフロー | Presigned URL 取得 → confirm 呼び出しの正常系・異常系 |
| 写真削除 | 削除 API の正常系・異常系 |
| URL 構築 | `getPhotoUrl(storagePath)` による MinIO URL 構築 |

コンポーネントテスト（React Testing Library）は将来拡張とする。

### テスト対象外（現時点）

| 対象 | 理由 |
|------|------|
| User / Project エンティティ | バリデーションが DomainError の throw のみで、単体テストの費用対効果が低い |
| Repository メソッド（フロントエンド） | hono/rpc の型安全性で保証。統合テストに委ねる |

## 5. テストの書き方

### 基本構造

```typescript
import { describe, expect, it } from "vitest";

describe("対象の関数名", () => {
  it("日本語で期待する振る舞いを記述する", () => {
    // Arrange
    const input = createSomething();

    // Act
    const result = doSomething(input);

    // Assert
    expect(result.ok).toBe(true);
  });
});
```

### Result 型のテスト

ドメイン操作は `Result<T, E>` を返す。成功・失敗の両方をテストする。

```typescript
it("有効な入力で ok: true を返す", () => {
  const result = changeStatus(issue, "in_progress", actorId);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.payload.to).toBe("in_progress");
});

it("無効な遷移で ok: false とエラーコードを返す", () => {
  const result = changeStatus(issue, "done", actorId);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe("INVALID_TRANSITION");
  }
});
```

### イベントソーシングのテスト

コマンド関数はイベントを返す。イベントの内容だけでなく、
`applyEvent` で状態に適用した結果も検証する。

```typescript
it("コマンド → イベント → 状態適用の一連を検証する", () => {
  const issue = makeIssue(); // IssueCreated を適用済みの状態
  const result = updateTitle(issue, "新しいタイトル", actorId);
  if (!result.ok) throw new Error();

  // イベントの内容を検証
  expect(result.value.type).toBe("IssueTitleUpdated");
  expect(result.value.version).toBe(issue.version + 1);

  // 状態適用後を検証
  const updated = applyEvent(issue, result.value);
  expect(updated.title).toBe("新しいタイトル");
});
```

## 6. カバレッジ方針

ドメイン層のカバレッジ目標は **100%**（Stmts / Branch / Funcs / Lines）。

ドメイン層は純粋関数のみで構成されており、テストのコストが低い。
カバレッジの漏れはビジネスロジックの検証漏れに直結するため、
100% を維持する。

インフラストラクチャ層は結合テストで全インターフェースメソッドを網羅する。
正常系・異常系・境界値の3観点を必ずカバーする。
