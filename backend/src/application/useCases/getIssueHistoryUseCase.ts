/**
 * 指摘変更履歴取得ユースケース（CQRS 読み取り側）。
 *
 * @remarks
 * IssueQueryService.getEventHistory を呼び出し、指摘のイベント一覧を返却する。
 * 監査証跡として「誰が・いつ・何を変えたか」を時系列で提供する。
 * 読み取り側のため EventStore やドメインモデルには依存しない。
 */

import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import type { IssueQueryService } from "../../domain/repositories/issueQueryService.js";
import type { IssueId } from "../../domain/valueObjects/brandedId.js";

/**
 * 指摘変更履歴取得ユースケースを生成する。
 *
 * @param queryService - 読み取り側クエリサービス
 * @returns 指摘 ID を受け取り、イベント一覧を返す関数
 */
export const getIssueHistoryUseCase =
  (queryService: IssueQueryService) =>
  async (id: IssueId): Promise<readonly IssueDomainEvent[]> => {
    return queryService.getEventHistory(id);
  };
