# デザイン運用ルール

## 基本方針: デザインファースト

.pen ファイルがデザインのソースオブトゥルース（正）であり、コードはデザインの実装である。

## ルール

### 1. 変更の方向は一方向

```
.pen（デザイン） → コード（実装）
```

- UI の見た目を変更する場合は、必ず .pen を先に更新してからコードを修正する
- コードで UI を変更してから .pen に反映する（逆流）は禁止

#### なぜ逆流を禁止するのか

双方向の同期を許すと「どちらが正しい状態か」が曖昧になり、管理コストが増大する。
一方向に限定することで、.pen を見れば常に正しいデザインが分かる状態を維持できる。

### 2. .pen はページ単位で作成

- `page.pen` を `page.tsx` と同じディレクトリに配置する
- コンポーネントごとの .pen は作らない

```
frontend/src/app/(app)/viewer/
├── page.tsx          # ページ実装
├── page.pen          # ページデザイン（ソースオブトゥルース）
├── issue-panel.tsx
├── issue-filter.tsx
├── timeline.tsx
├── composer.tsx
└── photo-lightbox.tsx
```

（本プロジェクトでは `_components/` は使わず、viewer 配下に UI とフックをフラットに配置している。）

#### なぜコンポーネントごとに作らないのか

.pen ファイル間でコンポーネントを共有・参照する仕組みがない。
コンポーネントごとに .pen を作ると、共通パーツ（ボタン、カラー、スペーシング等）が重複管理になる。

### 3. .pen 内のノード命名規約

.pen 内のノード名は実装コンポーネント名に合わせる。
これにより、page.pen のどのノードがどのコンポーネントに対応するかを追跡できる。

```
page.pen 内のノード構造:
├── IssueFilter       ← issue-filter.tsx に対応
│   ├── StatusSelect
│   └── AssigneeSelect
├── IssueListPanel    ← issue-list-panel.tsx に対応
│   └── IssueCard
└── IssuePanel        ← issue-panel.tsx に対応
    ├── Timeline
    └── Composer
```

### 4. .pen 内の reusable コンポーネント

page.pen 内では `reusable: true` でコンポーネントを定義し、`ref` で再利用できる。
繰り返し使われる UI パーツ（カード、リストアイテム等）はこの仕組みを活用する。

### 5. コンポーネント分割はデザインに影響しない

`page.tsx` を `_components/` に分割・統合するのは実装の都合。
.pen のノード構造を変える必要はない。

## ワークフローとの関係

### Issue 作成時（workflow:issue:add）

- フロントエンド作業がある場合、Phase 3 で page.pen を作成
- ノード名は想定されるコンポーネント名に合わせる

### Feature 実装時（workflow:feature）

- Phase 1 で page.pen からデザイン情報を取得
- Phase 6 の実装では page.pen のデザインに従う
- UI の微調整が必要な場合でも、先に page.pen を Pencil MCP で更新 → コード修正の順
