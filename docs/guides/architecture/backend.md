# バックエンド設計の詳細

## 依存方向の設計意図

```
presentation → application → domain ← infrastructure
```

- `domain` はどこにも依存しない（純粋なビジネスロジック）
- `infrastructure` は `domain` のインターフェースを実装する（依存性逆転）
- `application` は `domain` のインターフェースに依存し、`infrastructure` の具体実装を知らない

## DI：高階関数パターン

DI コンテナやデコレータを使わず、高階関数で依存を注入する。
`init` 関数が依存を受け取り、ユースケース群を返すことで、
ワイヤリングを Composition Root に集約し、テスト時はモックに差し替える。

### 実装例

```typescript
// domain/repositories/issueRepository.ts
type IssueRepository = {
    findById: (id: string) => Promise<Issue | null>;
    save: (issue: Issue) => Promise<void>;
};

// domain/services/blobStorage.ts
type BlobStorage = {
    generateUploadUrl: (issueId: string, photoId: string, fileName: string, phase: PhotoPhase) => Promise<{ uploadUrl: string }>;
    confirmPending: (issueId: string, photos: Photo[]) => Promise<readonly Photo[]>;
    deleteByIssue: (issueId: string) => Promise<void>;
    deletePhoto: (storagePath: string) => Promise<void>;
};

// application/useCases/issueUseCases.ts
type IssueUseCases = {
    create: (input: CreateIssueInput) => Promise<Issue>;
    updateStatus: (id: string, status: Status) => Promise<Issue>;
};

const initIssueUseCases = (
    repo: IssueRepository,
    storage: BlobStorage,
): IssueUseCases => ({
    create: async (input) => {
        const issue = Issue.create(input);
        await repo.save(issue);
        if (input.photos.length > 0) {
            await storage.confirmPending(issue.id, input.photos);
        }
        return issue;
    },
    updateStatus: async (id, status) => {
        const issue = await repo.findById(id);
        if (!issue) throw new NotFoundError("Issue", id);
        issue.changeStatus(status);
        await repo.save(issue);
        return issue;
    },
});

// infrastructure/persistence/issueRepositoryImpl.ts
const createIssueRepository = (db: Database): IssueRepository => ({
    findById: async (id) => {
        const row = await db.query("SELECT * FROM issues WHERE id = $1", [id]);
        return row ? toEntity(row) : null;
    },
    save: async (issue) => {
        await db.query("INSERT INTO issues ...", toRow(issue));
    },
});

// compositionRoot.ts — 依存の組み立てを一箇所に集約
const db = createDatabase(process.env.DATABASE_URL);
const issueRepo = createIssueRepository(db);
const blobStorage = createBlobStorage(minioClient, bucket);

export const issueUseCases = initIssueUseCases(issueRepo, blobStorage);

// presentation/routes/issues.ts — ルートは依存を意識しない
import { issueUseCases } from "../../compositionRoot";

app.post("/issues", async (c) => {
    const result = await issueUseCases.create(input);
    return c.json(result, 201);
});

// テスト — モックの注入
const mockRepo: IssueRepository = {
    findById: async () => null,
    save: async () => {},
};
const mockStorage: BlobStorage = {
    confirmPending: async () => {},
};
const testUseCases = initIssueUseCases(mockRepo, mockStorage);
```

## ステータス遷移

指摘のステータスは以下の順序で遷移する:

```
Open → In Progress → In Review → Done
                   ↖︎            ↙︎
                    (差し戻し)
```

- **Open**: 新規登録された指摘
- **In Progress**: 是正作業中
- **In Review**: 是正完了、管理者による確認待ち
- **Done**: 確認完了

遷移ルールは `domain/valueObjects/` で定義し、不正な遷移をドメイン層で防止する。
差し戻し（In Review → In Progress）により、是正のやり直しフローに対応する。

## CQRS + イベントソーシング

読み取り（Query）と書き込み（Command）の責務を分離する。
Issue 集約の状態変化はイベントソーシングで記録し、監査証跡の土台とする。

- **Command**: コマンド関数がビジネスルールを検証し、ドメインイベントを生成 → EventStore に追記
- **Query**: 投影テーブルから直接取得。イベントや集約を経由しない

詳細: [`event-sourcing.md`](../event-sourcing.md)

## プレゼンテーション層の規約

### API エラーレスポンス

全エンドポイントで統一のエラーエンベロープを使用する:

```json
{
  "error": {
    "code": "ISSUE_NOT_FOUND",
    "message": "Issue not found: ..."
  }
}
```

- `code` — プログラム的に判別可能な文字列。ドメイン層の `DomainErrorDetail.code` と対応
- `message` — 人間向けの説明

errorHandler（`onError`）と各ルートハンドラの両方でこの形式を守る。

### エラーコード → HTTP ステータスマッピング

`mapResultErrorToStatus` でドメインのエラーコードを HTTP ステータスに変換する。
ドメイン層にエラーコードを追加した場合は、このマッピングも同時に更新すること。

| HTTP | エラーコード例 |
|------|-------------|
| 400 | `EMPTY_TITLE`, `NO_CHANGE`, `NO_CHANGES`, `INVALID_FILE_EXTENSION` |
| 404 | `*_NOT_FOUND`（suffix マッチ） |
| 409 | `INVALID_TRANSITION`, `CONCURRENCY_CONFLICT`, `DUPLICATE_PHOTO` |
| 500 | 上記以外（`SAVE_FAILED`, `QUERY_FAILED` 等） |

### API 境界での ID 変換

外部 API では base62 エンコード ID を使用し、内部では UUID を使用する。
変換は presentation 層のみで行う。

- **リクエスト**: `base62ToUuid()` → `parseId<T>()` でブランド型に変換
- **レスポンス**: `uuidToBase62()` で変換

ネストされたオブジェクト（イベントの payload 等）内の ID も変換が必要。
また、内部パス（`storagePath` 等）はレスポンスに含めない。

### 入力バリデーション（zod スキーマ）

システム境界で zod スキーマによるバリデーションを行う。
ドメイン層のバリデーション仕様と一貫させること:

- **name / title**: `.trim().min(1)` — ドメイン層は trim 後に空チェックするため、スキーマ側でも trim して弾く
- **文字列長制限**: `.max(N)` を必ず付ける（DoS 防止）
- **ファイル名**: パストラバーサル文字（`/`, `\`, `..`）を禁止する

## NullObject パターン

必要な箇所で適切に適用する。
例: 写真が0枚の指摘、未割り当ての担当者など、null チェックの散乱を防ぐ。
