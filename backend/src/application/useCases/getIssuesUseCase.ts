/**
 * 指摘一覧取得ユースケース（CQRS 読み取り側）。
 *
 * @remarks
 * IssueQueryService.findAll を呼び出し、フィルタ条件に一致する指摘一覧を返却する。
 * 読み取り側のため EventStore やドメインモデルには依存しない。
 */

import type {
  IssueFilters,
  IssueListItem,
  IssueQueryService,
} from "../../domain/repositories/issueQueryService.js";

/**
 * 指摘一覧取得ユースケースを生成する。
 *
 * @param queryService - 読み取り側クエリサービス
 * @returns フィルタ条件を受け取り、指摘一覧を返す関数
 */
export const getIssuesUseCase =
  (queryService: IssueQueryService) =>
  async (filters?: IssueFilters): Promise<readonly IssueListItem[]> => {
    return queryService.findAll(filters);
  };
