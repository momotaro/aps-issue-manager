# API 設計

> ベース URL: `http://localhost:4000`
>
> すべての ID は **base62 エンコード（22 文字）** で送受信する。
> 内部では UUID v7 に変換して処理する。

## 共通仕様

### エラーレスポンス

```json
{ "error": { "code": "ISSUE_NOT_FOUND", "message": "Issue not found" } }
```

| コード（suffix 含む） | HTTP ステータス | 意味 |
|--------|----------------|------|
| `*_NOT_FOUND` | 404 | リソースが存在しない |
| `INVALID_TRANSITION` | 409 | 許可されないステータス遷移 |
| `CONCURRENCY_CONFLICT` | 409 | 楽観的同時実行制御の競合 |
| `DUPLICATE_PHOTO` | 409 | 添付写真の重複 |
| `EMPTY_TITLE`, `NO_CHANGE`, `NO_CHANGES`, `INVALID_FILE_EXTENSION` | 400 | バリデーションエラー |
| それ以外（`SAVE_FAILED`, `QUERY_FAILED` 等） | 500 | サーバーエラー |

マッピング詳細は `presentation/middleware/errorHandler.ts` の `mapResultErrorToStatus` を参照。

### 共通型

**Position**（判別共用体）

```jsonc
// 空間指摘（3D 上の任意座標）
{ "type": "spatial", "worldPosition": { "x": 0, "y": 0, "z": 0 } }

// 部材指摘（Viewer の dbId + 座標）
{ "type": "component", "dbId": 123, "worldPosition": { "x": 0, "y": 0, "z": 0 } }
```

**列挙値**

| 名前 | 値 |
|------|-----|
| Status | `open`, `in_progress`, `in_review`, `done` |
| Category | `quality_defect`, `safety_hazard`, `construction_defect`, `design_change` |
| User Role | `admin`, `manager`, `member` |

---

## Health Check

### `GET /health`

| 項目 | 値 |
|------|-----|
| 認証 | 不要 |
| レスポンス | `{ "status": "ok" }` |

---

## APS

### `GET /api/aps/token`

APS の 2-legged OAuth トークンを取得する。バックエンドでキャッシュされたトークンを返す。

| 項目 | 値 |
|------|-----|
| 成功 | `200 { "access_token": "..." }` |
| APS 未設定 | `503 { "error": "APS is not configured" }` |
| 取得失敗 | `500 { "error": "Failed to get APS token" }` |

---

## Issues

### `POST /api/issues`

指摘を新規登録する。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `issueId` | string | Yes | base62（22 文字）、クライアント側で生成 |
| `projectId` | string | Yes | base62 |
| `title` | string | Yes | 1〜200 文字 |
| `category` | string | Yes | Category 列挙値 |
| `position` | Position | Yes | 空間 or 部材 |
| `reporterId` | string | Yes | base62 |
| `assigneeId` | string \| null | No | base62 or null |
| `comment` | object | Yes | 初回コメント（下記参照） |

**`comment` オブジェクト**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `commentId` | string | Yes | base62（22 文字）、クライアント側で生成 |
| `body` | string | Yes | 1〜2,000 文字（trim 後） |
| `attachments` | Photo[] | No | 最大 10 件。各要素は `{ id, fileName, storagePath, uploadedAt }`。`storagePath` は `pending/` で始まる |

**レスポンス**: `201 { "issueId": "..." }`

---

### `GET /api/issues`

指摘一覧を取得する。フィルター・ソートに対応。

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `projectId` | string | No | base62 |
| `status` | string | No | Status 列挙値 |
| `category` | string | No | Category 列挙値 |
| `assigneeId` | string | No | base62 |
| `q` | string | No | キーワード検索（最大 200 文字） |
| `sortBy` | string | No | `createdAt` \| `updatedAt` |
| `sortOrder` | string | No | `asc` \| `desc` |

**レスポンス**: `200 IssueListItem[]`

```json
[
  {
    "id": "...",
    "projectId": "...",
    "title": "手すり未設置",
    "status": "open",
    "category": "safety_hazard",
    "reporterId": "...",
    "reporterName": "佐藤",
    "assigneeId": "...",
    "assigneeName": "山本",
    "position": { "type": "spatial", "worldPosition": { "x": 1, "y": 2, "z": 3 } },
    "createdAt": "2026-04-10T00:00:00.000Z",
    "updatedAt": "2026-04-10T00:00:00.000Z"
  }
]
```

---

### `GET /api/issues/:id`

指摘の詳細（コメント情報を含む）を取得する。

**レスポンス**: `200 IssueDetail`

```json
{
  "id": "...",
  "projectId": "...",
  "title": "手すり未設置",
  "status": "open",
  "category": "safety_hazard",
  "reporterId": "...",
  "reporterName": "佐藤",
  "assigneeId": "...",
  "assigneeName": "山本",
  "position": { "type": "spatial", "worldPosition": { "x": 1, "y": 2, "z": 3 } },
  "createdAt": "2026-04-10T00:00:00.000Z",
  "updatedAt": "2026-04-10T00:00:00.000Z",
  "recentComments": [
    {
      "commentId": "...",
      "body": "3F 東側通路に手すりが設置されていない",
      "actorId": "...",
      "attachments": [
        {
          "id": "...",
          "fileName": "IMG_001.jpg",
          "storagePath": "confirmed/{issueId}/{commentId}/{photoId}.jpg",
          "uploadedAt": "2026-04-10T00:00:00.000Z"
        }
      ],
      "createdAt": "2026-04-10T00:00:00.000Z"
    }
  ]
}
```

`recentComments` は最新 5 件のみ。全コメントが必要な場合は `GET /api/issues/:id/history` で `CommentAdded` イベントを取得する。

---

### `PUT /api/issues/:id`

指摘の基本情報を部分更新する。指定したフィールドのみ更新され、変更のないフィールドは無視される。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `title` | string | No | 1〜200 文字（trim 後） |
| `category` | string | No | Category 列挙値 |
| `assigneeId` | string \| null | No | base62 or null（解除） |
| `actorId` | string | Yes | base62 |

**レスポンス**: `200 { "ok": true }`

---

### ステータス遷移エンドポイント

ステータス遷移はコメント付きのユースケース指向エンドポイントで行う。
直接 status のみを更新する汎用エンドポイントは提供しない（履歴上コメントが必須のため）。

**許可される遷移**

```
open → in_progress → in_review → done
                      ↓ (差し戻し)
                  in_progress
```

### `POST /api/issues/:id/correct`

是正コメントを追加し、必要ならステータスを `in_progress` に遷移する。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `status` | string | No | 指定した場合のみステータス遷移（例: `in_progress`）。省略時はコメント追加のみ |
| `actorId` | string | Yes | base62 |
| `comment.commentId` | string | Yes | base62（22 文字） |
| `comment.body` | string | Yes | 1〜2,000 文字 |
| `comment.attachments` | Photo[] | No | 最大 10 件（pending 添付） |

**レスポンス**: `200 { "ok": true }`

不正な遷移: `409 { "error": { "code": "INVALID_TRANSITION", ... } }`

---

### `POST /api/issues/:id/review`

レビュー依頼コメントを追加し、必要ならステータスを `in_review` / `done` に遷移する。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `status` | string | No | 指定した場合のみステータス遷移 |
| `actorId` | string | Yes | base62 |
| `comment.commentId` | string | Yes | base62 |
| `comment.body` | string | Yes | 1〜2,000 文字 |

**レビューコメントには添付写真は付けられない** — `attachments` は受け付けない。

**レスポンス**: `200 { "ok": true }`

---

### `POST /api/issues/:id/comments`

指摘に通常のコメントを追加する（ステータスは変更しない）。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `actorId` | string | Yes | base62 |
| `comment.commentId` | string | Yes | base62（22 文字） |
| `comment.body` | string | Yes | 1〜2,000 文字 |
| `comment.attachments` | Photo[] | No | 最大 10 件（pending 添付） |

**レスポンス**: `201 { "ok": true }`

---

### `DELETE /api/issues/:id`

指摘を削除する（関連イベント・写真 Blob を含む）。

**レスポンス**: `200 { "ok": true }`

---

### `GET /api/issues/:id/history`

指摘のイベント履歴を取得する（イベントソーシングの全イベント）。

**レスポンス**: `200 IssueEvent[]`

```json
[
  {
    "id": "...",
    "issueId": "...",
    "type": "IssueCreated",
    "payload": { "projectId": "...", "title": "手すり未設置", "status": "open", "category": "safety_hazard", "position": { "type": "spatial", "worldPosition": { "x": 1, "y": 2, "z": 3 } }, "reporterId": "...", "assigneeId": null },
    "actorId": "...",
    "version": 1,
    "occurredAt": "2026-04-10T00:00:00.000Z"
  },
  {
    "id": "...",
    "issueId": "...",
    "type": "CommentAdded",
    "payload": {
      "comment": {
        "commentId": "...",
        "body": "3F 東側通路に手すりが設置されていない",
        "actorId": "...",
        "attachments": [
          { "id": "...", "fileName": "IMG_001.jpg", "storagePath": "confirmed/...", "uploadedAt": "2026-04-10T00:00:00.000Z" }
        ],
        "createdAt": "2026-04-10T00:00:00.000Z"
      }
    },
    "actorId": "...",
    "version": 2,
    "occurredAt": "2026-04-10T00:00:00.000Z"
  }
]
```

**イベント型一覧**: `IssueCreated`, `IssueTitleUpdated`, `IssueStatusChanged`, `IssueCategoryChanged`, `IssueAssigneeChanged`, `CommentAdded`

各イベントの payload 構造は `domain/events/issueEvents.ts` を参照。`CommentAdded` のみ `{ comment: {...} }` とネストし、それ以外は payload 直下にフィールドが並ぶ。

---

## Photos

### `POST /api/issues/:id/photos/upload-url`

写真アップロード用の Presigned PUT URL を生成する。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `fileName` | string | Yes | 1〜255 文字、パス区切り・`..` 禁止 |
| `commentId` | string | Yes | base62（対象コメントの ID） |

**レスポンス**: `200 { "photoId": "...", "uploadUrl": "...", "storagePath": "pending/{issueId}/{commentId}/{photoId}.{ext}" }`

フロントエンドは返された `uploadUrl` に対して直接 PUT でファイルをアップロードする。
`storagePath` はコメント送信時の `attachments` にそのまま含める。

**confirm API は存在しない**: pending → confirmed の移動は `POST /api/issues/:id/comments`（および `/correct`, `/` create）の中で、backend の useCase が attachments を受け取った時点で行う。フロント側は confirm API を呼ぶ必要はない。

---

## Users

### `POST /api/users`

ユーザーを登録する。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `name` | string | Yes | 1 文字以上 |
| `email` | string | Yes | メールアドレス形式 |
| `role` | string | Yes | `admin` \| `manager` \| `member` |

**レスポンス**: `201 User`

```json
{
  "id": "...",
  "name": "佐藤",
  "email": "sato@example.com",
  "role": "admin",
  "createdAt": "2026-04-10T00:00:00.000Z",
  "updatedAt": "2026-04-10T00:00:00.000Z"
}
```

---

### `GET /api/users`

全ユーザー一覧を取得する。

**レスポンス**: `200 User[]`

---

### `GET /api/users/:id`

ユーザー詳細を取得する。

**レスポンス**: `200 User`

---

### `PUT /api/users/:id`

ユーザー情報を更新する。

**リクエストボディ**（すべて任意）

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `name` | string | No | 1 文字以上 |
| `email` | string | No | メールアドレス形式 |
| `role` | string | No | `admin` \| `manager` \| `member` |

**レスポンス**: `200 User`

---

## Projects

### `POST /api/projects`

プロジェクトを登録する。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `name` | string | Yes | 1〜200 文字 |
| `description` | string | Yes | 最大 10,000 文字 |
| `modelUrn` | string | Yes | 最大 500 文字（APS モデル URN） |

**レスポンス**: `201 Project`

```json
{
  "id": "...",
  "name": "Aビル新築工事",
  "description": "中規模オフィスビル",
  "modelUrn": "dXJuOm...",
  "createdAt": "2026-04-10T00:00:00.000Z",
  "updatedAt": "2026-04-10T00:00:00.000Z"
}
```

---

### `GET /api/projects`

全プロジェクト一覧を取得する。

**レスポンス**: `200 Project[]`

---

### `GET /api/projects/:id`

プロジェクト詳細を取得する。

**レスポンス**: `200 Project`

---

### `PUT /api/projects/:id`

プロジェクト情報を更新する。

**リクエストボディ**（すべて任意）

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `name` | string | No | 1〜200 文字 |
| `description` | string | No | 最大 10,000 文字 |
| `modelUrn` | string | No | 最大 500 文字 |

**レスポンス**: `200 Project`
