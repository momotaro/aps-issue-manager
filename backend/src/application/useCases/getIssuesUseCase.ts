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
  QueryOptions,
} from "../../domain/repositories/issueQueryService.js";
import type {
  DomainErrorDetail,
  Result,
} from "../../domain/valueObjects/result.js";
import { err } from "../../domain/valueObjects/result.js";

/**
 * 指摘一覧取得ユースケースを生成する。
 *
 * @param queryService - 読み取り側クエリサービス
 * @returns フィルタ条件とクエリオプションを受け取り、指摘一覧を返す関数
 */
export const getIssuesUseCase =
  (queryService: IssueQueryService) =>
  async (
    filters?: IssueFilters,
    options?: QueryOptions,
  ): Promise<Result<readonly IssueListItem[], DomainErrorDetail>> => {
    try {
      const items = await queryService.findAll(filters, options);
      return { ok: true, value: items };
    } catch (error) {
      return err({
        code: "QUERY_FAILED",
        message: `Failed to fetch issues: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };
