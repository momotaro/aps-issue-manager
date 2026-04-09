# API 設計

> ベース URL: `http://localhost:4000`
>
> すべての ID は **base62 エンコード（22 文字）** で送受信する。
> 内部では UUID v7 に変換して処理する。

## 共通仕様

### エラーレスポンス

```json
{ "error": { "code": "NOT_FOUND", "message": "Issue not found" } }
```

| コード | HTTP ステータス | 意味 |
|--------|----------------|------|
| `NOT_FOUND` | 404 | リソースが存在しない |
| `INVALID_TRANSITION` | 422 | 許可されないステータス遷移 |
| `CONCURRENCY_ERROR` | 409 | 楽観的同時実行制御の競合 |
| `VALIDATION_ERROR` | 400 | バリデーションエラー |

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
| Photo Phase | `before`, `after` |
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
| `description` | string | Yes | 最大 10,000 文字 |
| `category` | string | Yes | Category 列挙値 |
| `position` | Position | Yes | 空間 or 部材 |
| `reporterId` | string | Yes | base62 |
| `assigneeId` | string \| null | No | base62 or null |

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
    "reporterName": "佐藤",
    "assigneeName": "山本",
    "position": { "type": "spatial", "worldPosition": { "x": 1, "y": 2, "z": 3 } },
    "photoCount": 2,
    "createdAt": "2026-04-10T00:00:00.000Z",
    "updatedAt": "2026-04-10T00:00:00.000Z"
  }
]
```

---

### `GET /api/issues/:id`

指摘の詳細（写真情報を含む）を取得する。

**レスポンス**: `200 IssueDetail`

```json
{
  "id": "...",
  "projectId": "...",
  "title": "手すり未設置",
  "status": "open",
  "category": "safety_hazard",
  "reporterName": "佐藤",
  "assigneeName": "山本",
  "position": { "type": "spatial", "worldPosition": { "x": 1, "y": 2, "z": 3 } },
  "photoCount": 1,
  "createdAt": "2026-04-10T00:00:00.000Z",
  "updatedAt": "2026-04-10T00:00:00.000Z",
  "description": "3F 東側通路に手すりが設置されていない",
  "photos": [
    {
      "id": "...",
      "fileName": "IMG_001.jpg",
      "storagePath": "confirmed/.../before/....jpg",
      "phase": "before",
      "uploadedAt": "2026-04-10T00:00:00.000Z"
    }
  ]
}
```

---

### `PUT /api/issues/:id/title`

タイトルを更新する。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `title` | string | Yes | 1〜200 文字 |
| `actorId` | string | Yes | base62 |

**レスポンス**: `200 { "ok": true }`

---

### `PUT /api/issues/:id/description`

説明を更新する。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `description` | string | Yes | 最大 10,000 文字 |
| `actorId` | string | Yes | base62 |

**レスポンス**: `200 { "ok": true }`

---

### `PUT /api/issues/:id/category`

種別を更新する。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `category` | string | Yes | Category 列挙値 |
| `actorId` | string | Yes | base62 |

**レスポンス**: `200 { "ok": true }`

---

### `PUT /api/issues/:id/assignee`

担当者を変更する。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `assigneeId` | string \| null | Yes | base62 or null（解除） |
| `actorId` | string | Yes | base62 |

**レスポンス**: `200 { "ok": true }`

---

### `POST /api/issues/:id/status`

ステータスを遷移する。

**許可される遷移**

```
open → in_progress → in_review → done
                      ↓ (差し戻し)
                  in_progress
```

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `status` | string | Yes | Status 列挙値 |
| `actorId` | string | Yes | base62 |

**レスポンス**: `200 { "ok": true }`

不正な遷移の場合: `422 { "error": { "code": "INVALID_TRANSITION", ... } }`

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
    "payload": { "title": "手すり未設置", "..." : "..." },
    "actorId": "...",
    "version": 1,
    "occurredAt": "2026-04-10T00:00:00.000Z"
  }
]
```

**イベント型一覧**: `IssueCreated`, `IssueTitleUpdated`, `IssueDescriptionUpdated`, `IssueStatusChanged`, `IssueCategoryChanged`, `IssueAssigneeChanged`, `PhotoAdded`, `PhotoRemoved`

---

## Photos

### `POST /api/issues/:id/photos/upload-url`

写真アップロード用の Presigned PUT URL を生成する。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `fileName` | string | Yes | 1〜255 文字、パス区切り・`..` 禁止 |
| `phase` | string | Yes | `before` \| `after` |

**レスポンス**: `200 { "photoId": "...", "uploadUrl": "..." }`

フロントエンドは返された `uploadUrl` に対して直接 PUT でファイルをアップロードする。

---

### `POST /api/issues/:id/photos/confirm`

アップロード完了を確認し、写真を指摘に紐づける。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `photoId` | string | Yes | base62（upload-url で取得した値） |
| `fileName` | string | Yes | 1〜255 文字 |
| `phase` | string | Yes | `before` \| `after` |
| `actorId` | string | Yes | base62 |

**レスポンス**: `201 { "ok": true }`

---

### `DELETE /api/issues/:id/photos/:photoId`

写真を削除する（DB イベント + Blob の両方を削除）。

**リクエストボディ**

| フィールド | 型 | 必須 | 制約 |
|-----------|------|------|------|
| `actorId` | string | Yes | base62 |

**レスポンス**: `200 { "ok": true }`

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
