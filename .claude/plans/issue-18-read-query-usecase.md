# Issue #18: 読み取りクエリユースケース実装計画

## 概要
CQRS 読み取り側の3つのユースケースを実装する。

## 実装ファイル

### 1. getIssuesUseCase.ts
- 高階関数 DI: `(queryService: IssueQueryService) => (filters?: IssueFilters) => Promise<readonly IssueListItem[]>`
- queryService.findAll(filters) を呼び出すだけの薄いラッパー

### 2. getIssueDetailUseCase.ts
- 高階関数 DI: `(queryService: IssueQueryService) => (id: IssueId) => Promise<Result<IssueDetail, DomainErrorDetail>>`
- queryService.findById(id) を呼び出し、null の場合は err を返却

### 3. getIssueHistoryUseCase.ts
- 高階関数 DI: `(queryService: IssueQueryService) => (id: IssueId) => Promise<readonly IssueDomainEvent[]>`
- queryService.getEventHistory(id) を呼び出すだけの薄いラッパー

## テストファイル（同階層コロケーション）
- getIssuesUseCase.test.ts
- getIssueDetailUseCase.test.ts
- getIssueHistoryUseCase.test.ts

## テスト方針
- IssueQueryService のモック実装
- 正常系・異常系カバー
- モックの引数検証
