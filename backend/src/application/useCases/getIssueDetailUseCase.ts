/**
 * 指摘詳細取得ユースケース（CQRS 読み取り側）。
 *
 * @remarks
 * IssueQueryService.findById を呼び出し、指定された ID の指摘詳細を返却する。
 * 存在しない場合は Result 型で失敗を返す。
 * 読み取り側のため EventStore やドメインモデルには依存しない。
 */

import type {
  IssueDetail,
  IssueQueryService,
} from "../../domain/repositories/issueQueryService.js";
import type { IssueId } from "../../domain/valueObjects/brandedId.js";
import {
  type DomainErrorDetail,
  err,
  ok,
  type Result,
} from "../../domain/valueObjects/result.js";

/**
 * 指摘詳細取得ユースケースを生成する。
 *
 * @param queryService - 読み取り側クエリサービス
 * @returns 指摘 ID を受け取り、詳細または NotFound エラーを返す関数
 */
export const getIssueDetailUseCase =
  (queryService: IssueQueryService) =>
  async (id: IssueId): Promise<Result<IssueDetail, DomainErrorDetail>> => {
    try {
      const detail = await queryService.findById(id);

      if (detail === null) {
        return err({
          code: "ISSUE_NOT_FOUND",
          message: `Issue not found: ${id}`,
        });
      }

      return ok(detail);
    } catch (error) {
      return err({
        code: "QUERY_FAILED",
        message: `Failed to get issue detail: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };
