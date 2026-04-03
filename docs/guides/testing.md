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

### テスト対象外（現時点）

| 対象 | 理由 |
|------|------|
| Repository 実装 | DB 依存。結合テストで扱う |
| API エンドポイント | HTTP 依存。E2E テストで扱う |
| User / Project エンティティ | バリデーションが DomainError の throw のみで、単体テストの費用対効果が低い |

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
