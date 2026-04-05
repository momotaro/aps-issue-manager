# Issue #10: 写真アップロード UI

## 概要

指摘に是正前/是正後の写真を添付できる UI を実装する。
バックエンド API（Issue #8）は実装済み。フロントエンドのみの変更。

## レビュー反映事項

- `issue-form.hooks.ts` を新設し、フォームロジックを UI から分離
- `usePhotoViewer` フックを新設し、ライトボックス・比較表示の状態を `page.tsx` から分離
- セキュリティ: MIME チェック（`file.type.startsWith('image/')`）をフロントでも実施
- セキュリティ: `URL.revokeObjectURL()` のクリーンアップ
- セキュリティ: Presigned URL をログに出力しない
- テスト追加: deletePhoto 異常系、XHR abort（アンマウント時）、confirm 失敗

## 実装順序

### Step 1: Repository 層 — 写真 API メソッド追加

**ファイル:** `frontend/src/repositories/issue-repository.ts`

- `getIssueDetail(id)` — 指摘詳細取得（写真一覧含む）
- `generatePhotoUploadUrl(issueId, fileName, phase)` — Presigned URL 取得
- `confirmPhotoUpload(issueId, photoId, fileName, phase, actorId)` — アップロード確定
- `removePhoto(issueId, photoId, actorId)` — 写真削除

### Step 2: カスタムフック — usePhotoUpload

**ファイル:** `frontend/src/app/viewer/photo-upload.hooks.ts`

- Presigned URL 取得 → MinIO へ XMLHttpRequest PUT → confirm API の一連フロー
- `upload.onprogress` でアップロード進捗率を管理
- 複数ファイル対応（キュー管理）
- ファイルサイズ制限（10MB）とファイル形式バリデーション（`file.type.startsWith('image/')`）
- 状態: `uploading[]`（photoId, fileName, progress）, `uploadedPhotos[]`
- コンポーネントアンマウント時に XHR を abort するクリーンアップ
- Presigned URL をコンソール・エラーオブジェクトにログしない

### Step 3: カスタムフック — useDeletePhoto

**ファイル:** `frontend/src/app/viewer/photo-upload.hooks.ts`（同ファイル）

- `useMutation` で `DELETE /api/issues/:id/photos/:photoId` 呼び出し
- 指摘詳細のキャッシュを楽観的更新

### Step 4: PhotoUploader コンポーネント

**ファイル:** `frontend/src/app/viewer/photo-uploader.tsx`

- フェーズタブ（是正前/是正後）切り替え
- ドラッグ&ドロップゾーン + ファイル選択ボタン
- `accept: image/*` でファイルフィルタ
- デザイン: .pen の PhotoField セクション準拠

### Step 5: PhotoThumbnails コンポーネント

**ファイル:** `frontend/src/app/viewer/photo-uploader.tsx`（同ファイル、内部コンポーネント）

- 64x64 サムネイルグリッド
- アップロード中: プログレスバー表示（青、高さ3px）
- 赤い×ボタンで削除
- クリックでライトボックス表示

### Step 6: PhotoLightbox コンポーネント

**ファイル:** `frontend/src/app/viewer/photo-lightbox.tsx`

- 半透明オーバーレイ（#000000CC）
- 写真の拡大表示
- 左右ナビゲーション（chevron-left/right）
- ページカウンター（1 / 3）
- ×ボタンで閉じる
- ESC キーで閉じる
- デザイン: .pen の PhotoLightbox (参考) フレーム準拠

### Step 7: PhotoComparison コンポーネント

**ファイル:** `frontend/src/app/viewer/photo-comparison.tsx`

- 2カラムレイアウト
- 是正前（赤ドット）/ 是正後（緑ドット）ラベル
- 写真並列表示
- ヘッダー（タイトル + 閉じるボタン）
- デザイン: .pen の PhotoComparison (参考) フレーム準拠

### Step 8: IssueFormPanel 統合

**ファイル:** `frontend/src/app/viewer/issue-form.tsx` + `issue-form.hooks.ts`（新規）

- `issue-form.hooks.ts` を新設し、フォームロジックを分離（UI/Logic 分離規約）
- フォーム下部に PhotoUploader を統合
- 新規作成時: 指摘作成後に issueId を受け取って写真をアップロード
- `issue-form.tsx` はピュアな表示コンポーネントとして維持

### Step 8.5: usePhotoViewer フック

**ファイル:** `frontend/src/app/viewer/photo-viewer.hooks.ts`（新規）

- ライトボックスの開閉・写真インデックス状態
- PhotoComparison の開閉状態
- `page.tsx` の肥大化を防ぐため専用フックに分離

### Step 9: PinPopup / 詳細画面統合

**ファイル:** `frontend/src/app/viewer/issue-pins.tsx`

- PinPopup に写真カウント表示
- 写真ボタンで PhotoComparison を開く
- 既存指摘への写真追加・削除

### Step 10: ViewerPage 統合

**ファイル:** `frontend/src/app/viewer/page.tsx`

- `usePhotoViewer` フックで状態管理
- PhotoLightbox / PhotoComparison のレンダリング
- 新規作成フロー: createIssue 成功後に写真アップロード開始

## 単体テスト計画

### photo-upload.hooks.test.ts
- **正常系**: Presigned URL 取得 → アップロード → confirm 成功
- **正常系**: 複数ファイルの順次アップロード
- **正常系**: 写真削除 → キャッシュ更新
- **異常系**: ファイルサイズ超過（10MB）でバリデーションエラー
- **異常系**: 非画像ファイルの拒否
- **異常系**: アップロード失敗時のエラーハンドリング
- **異常系**: 写真削除 API 失敗時のエラーハンドリング
- **異常系**: confirm API 失敗時のロールバック（pending 残留ケース）
- **異常系**: コンポーネントアンマウント時の XHR abort
- **境界値**: 0バイトファイル、ちょうど10MBのファイル

### Repository テスト（既存パターンに準拠）
- API メソッドの型安全性は hono/rpc で保証されるため、統合テストに委ねる

## E2E テスト計画

### photo-upload.spec.ts
1. 写真をドラッグ&ドロップでアップロード → サムネイル表示確認
2. ファイル選択ダイアログからアップロード → サムネイル表示確認
3. アップロード中のプログレスバー表示確認
4. サムネイルクリック → ライトボックス表示 → 左右ナビゲーション → 閉じる
5. 写真の削除 → サムネイル消失確認
6. 是正前/是正後タブ切り替え
7. 是正前/是正後の比較表示

## DB マイグレーション

なし（フロントエンドのみの変更）

## ドキュメント更新（Phase 9 で実施）

| ファイル | 更新内容 |
|---------|---------|
| `docs/guides/architecture/frontend.md` | 写真アップロードアーキテクチャ、フォームロジック分離パターン、写真関連 Repository メソッド |
| `docs/guides/testing.md` | フロントエンドフック・コンポーネントテストの方針追加 |
| `docs/guides/future-considerations.md` | サムネイル生成・CDN・画像最適化の拡張方針 |
