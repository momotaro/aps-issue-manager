/**
 * 指摘削除ユースケース。
 *
 * @remarks
 * DB を先に削除し、その後 Blob を削除する。この順序により、
 * DB 削除失敗時に Blob だけ消えている不整合を防ぐ。
 * Blob 削除失敗時は孤児ファイルが残るだけで、データ整合性には影響しない。
 *
 * イベントソーシングの設計上、`IssueDeleted` イベントは定義せず、
 * 集約ごと物理削除する方針を採用している。
 */

import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import type { IssueId } from "../../domain/valueObjects/brandedId.js";
import type {
  DomainErrorDetail,
  Result,
} from "../../domain/valueObjects/result.js";
import { err, ok } from "../../domain/valueObjects/result.js";

/** ユースケースの入力型。 */
export type DeleteIssueInput = {
  readonly issueId: IssueId;
};

/**
 * 指摘削除ユースケースを生成する高階関数。
 *
 * @param issueRepo - IssueRepository の実装
 * @param blobStorage - BlobStorage の実装
 * @returns 指摘削除を実行する非同期関数
 */
export const deleteIssueUseCase =
  (issueRepo: IssueRepository, blobStorage: BlobStorage) =>
  async (input: DeleteIssueInput): Promise<Result<void, DomainErrorDetail>> => {
    const issue = await issueRepo.load(input.issueId);
    if (issue === null) {
      return err({
        code: "ISSUE_NOT_FOUND",
        message: `Issue not found: ${input.issueId}`,
      });
    }

    // DB 削除を先に実行（データ整合性優先）
    try {
      await issueRepo.delete(input.issueId);
    } catch (error) {
      return err({
        code: "DELETE_FAILED",
        message: `Failed to delete issue: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // Blob 削除（失敗しても孤児が残るだけで整合性には影響しない）
    try {
      await blobStorage.deleteByIssue(input.issueId);
    } catch {
      // Blob 削除失敗は非致命的。孤児ファイルはバックグラウンドで回収可能
    }

    return ok(undefined);
  };
