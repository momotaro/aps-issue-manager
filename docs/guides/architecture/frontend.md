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
2. Repository 経由で Presigned PUT URL を取得（`POST /api/issues/:id/photos/upload-url`、`commentId` を送信）
3. `XMLHttpRequest` で MinIO に直接 PUT（`upload.onprogress` で進捗取得）
4. アップロード完了後、コメント投稿時に添付情報を `attachments` として含める
5. `queryClient.invalidateQueries` でキャッシュ更新

### コンポーネント構成

| ファイル | 責務 |
|---------|------|
| `photo-upload.hooks.ts` | アップロード状態（pending/uploading/attachments）の管理と削除ロジック |
| `photo-lightbox.tsx` | 写真拡大オーバーレイ。キーボード/ボタンでのページ送り、投稿者・日時・コメント本文の情報パネルを含む |
| `composer.tsx` | コメント入力欄に添付プレビュー・ファイル選択 UI を内包（専用の photo-uploader コンポーネントは持たない） |

`PhotoLightbox` は `LightboxPhoto` 型で写真を受け取り、任意の `CommentContext`
（投稿者名・アバター色・投稿日時・コメント本文）を添えると情報パネルを表示する。
`toLightboxPhotoFromStoragePath` ヘルパーで Timeline のコメント添付から組み立てる。

### ステータス表示の色統一

`frontend/src/types/issue.ts` の `STATUS_COLORS` を単一ソースとし
（`viewer/types.ts` から re-export）、IssuePanel ヘッダーのバッジと
Timeline のステータス変更イベントで同じ配色を使う。
ラベルとアイコンの色を別々に定義しないことで、ステータスごとの見た目の一貫性を保つ。

### フォームロジック分離

`issue-form.tsx`（UI）と `issue-form.hooks.ts`（ロジック）を分離。
フォーム状態（react-hook-form）と写真添付状態をフックに集約し、
フォームコンポーネントは props 経由で受け取るピュアな表示に徹する。

### 写真 URL 構築

確認済み写真は MinIO の公開読み取りポリシーで配信。
`getPhotoUrl(storagePath)` ユーティリティで URL を構築する。
