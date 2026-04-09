# アーキテクチャ設計

> 技術スタック・ディレクトリ構成・制約事項の一覧は `CLAUDE.md` を参照。
> 本ドキュメントでは設計判断の背景と詳細を記述する。

- [フロントエンド設計](./frontend.md)
- [バックエンド設計](./backend.md)

## 1. 全体構成図

```mermaid
graph TB
  subgraph Client["クライアント"]
    Browser["ブラウザ"]
  end

  subgraph App["アプリケーション"]
    FE["Frontend<br/>Next.js :3000"]
    BE["Backend<br/>Hono/RPC :4000"]
  end

  subgraph Infra["インフラ（Docker）"]
    DB["PostgreSQL :5432"]
    MinIO["MinIO :9000/9001"]
    Cleanup["minio-cleanup<br/>Orphan 自動削除"]
  end

  External["APS API<br/>Autodesk Platform Services"]

  Browser -->|"HTTP"| FE
  FE -->|"Hono RPC<br/>型共有"| BE
  Browser -->|"Presigned PUT<br/>写真直接アップロード"| MinIO
  BE --> DB
  BE --> MinIO
  BE -->|"2-legged OAuth"| External
  Cleanup -->|"5分間隔スキャン<br/>10分超過ファイル削除"| MinIO
```

### コンテナ構成（docker-compose）

| サービス      | イメージ           | 役割                      |
| ------------- | ------------------ | ------------------------- |
| frontend      | node:22-alpine     | Next.js App Router        |
| backend       | node:22-alpine     | Hono API サーバー         |
| db            | postgres:17-alpine | データ永続化              |
| minio         | minio/minio        | Blob ストレージ（S3互換） |
| minio-cleanup | minio/mc           | Orphanファイル自動削除    |

## 2. Hono RPC による型共有

backend の `AppType` を export し、frontend から import することで、
API のリクエスト/レスポンスの型をビルド時に共有する。
REST API でありながら、型安全な通信を実現する。

