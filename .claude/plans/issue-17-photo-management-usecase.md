# Issue #17: 写真管理ユースケース実装計画

## 概要
写真管理の3つのユースケースを application 層に実装する。

## 前提: BlobStorage インターフェース拡張
現在の `BlobStorage` には `generateUploadUrl` と `deletePhoto` がない。
ユースケースが必要とするメソッドを追加する。

### 追加メソッド
1. `generateUploadUrl(issueId, photoId, fileName, phase)` → `{ uploadUrl: string, pendingPath: string }`
2. `confirmPending(issueId, photos)` → 既存（そのまま使用）
3. `deletePhoto(issueId, photoId, phase, ext)` → 個別写真の削除

## ユースケース

### 1. generatePhotoUploadUrlUseCase
- 入力: `{ issueId, fileName, phase }`
- 処理: photoId 生成 → blobStorage.generateUploadUrl → URL 返却
- 出力: `{ photoId, uploadUrl }`

### 2. confirmPhotoUploadUseCase
- 入力: `{ issueId, photoId, fileName, phase, actorId }`
- 処理: issueRepo.load → 存在チェック → confirmPending → addPhoto → issueRepo.save
- 出力: void

### 3. removePhotoUseCase
- 入力: `{ issueId, photoId, actorId }`
- 処理: issueRepo.load → 存在チェック → removePhoto → issueRepo.save → blobStorage.deletePhoto
- 出力: void

## テスト方針
- モック実装で正常系・異常系をカバー
- テストファイルは実装と同階層にコロケーション
