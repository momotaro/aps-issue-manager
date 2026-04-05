# フロントエンド設計の詳細

## コンポーネント設計の背景

UI とロジックを分離する理由:

- `xxx.tsx`（表示責務のみ）— テストしやすく、再利用しやすい
- `xxx.hooks.tsx`（状態管理、データ取得、イベントハンドリング）— ロジックの単体テストが可能

## データ取得の抽象化

TanStack Query を直接コンポーネントから呼ぶのではなく、
Repository パターンで抽象化し、データソースの差し替えを容易にする。

## 写真アップロードアーキテクチャ

### アップロードフロー

Presigned URL 方式でバックエンドを経由せず MinIO に直接アップロードする。

1. `usePhotoUpload` フックがフロー全体を管理
2. Repository 経由で Presigned PUT URL を取得（`POST /api/issues/:id/photos/upload-url`）
3. `XMLHttpRequest` で MinIO に直接 PUT（`upload.onprogress` で進捗取得）
4. 成功後に confirm API を呼び出し（`POST /api/issues/:id/photos/confirm`）
5. `queryClient.invalidateQueries` でキャッシュ更新

### コンポーネント構成

| ファイル | 責務 |
|---------|------|
| `photo-upload.hooks.ts` | アップロード・削除・詳細取得のロジック |
| `photo-viewer.hooks.ts` | ライトボックス・比較表示の状態管理 |
| `photo-uploader.tsx` | ドロップゾーン・フェーズタブ・サムネイルの UI |
| `photo-lightbox.tsx` | 写真拡大オーバーレイ |
| `photo-comparison.tsx` | 是正前/後の並列比較表示 |

### フォームロジック分離

`issue-form.tsx`（UI）と `issue-form.hooks.ts`（ロジック）を分離。
フォーム状態（react-hook-form）と写真フェーズ状態をフックに集約し、
フォームコンポーネントは props 経由で受け取るピュアな表示に徹する。

### 写真 URL 構築

確認済み写真は MinIO の公開読み取りポリシーで配信。
`getPhotoUrl(storagePath)` ユーティリティで URL を構築する。
