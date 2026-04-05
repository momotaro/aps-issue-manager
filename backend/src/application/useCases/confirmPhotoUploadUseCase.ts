/**
 * 写真アップロード確定ユースケース。
 *
 * @remarks
 * PhotoAdded イベントを先に永続化し、その後 pending → confirmed に Blob を移動する。
 * この順序により、DB保存失敗時にconfirmedに孤児ファイルが残ることを防ぐ。
 * Blob移動失敗時はイベント永続化済みだが、pending ファイルは minio-cleanup の
 * TTL(10分) で自動削除される。リトライ可能な設計。
 */

import { addPhoto } from "../../domain/entities/issue.js";
import type { IssueRepository } from "../../domain/repositories/issueRepository.js";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import { ConcurrencyError } from "../../domain/services/errors.js";
import type {
  IssueId,
  PhotoId,
  UserId,
} from "../../domain/valueObjects/brandedId.js";
import {
  confirmedBlobPath,
  createPhoto,
  type PhotoPhase,
  pendingBlobPath,
} from "../../domain/valueObjects/photo.js";
import type {
  DomainErrorDetail,
  Result,
} from "../../domain/valueObjects/result.js";
import { err } from "../../domain/valueObjects/result.js";

/** ユースケースの入力型。 */
export type ConfirmPhotoUploadInput = {
  readonly issueId: IssueId;
  readonly photoId: PhotoId;
  readonly fileName: string;
  readonly phase: PhotoPhase;
  readonly actorId: UserId;
};

/**
 * 写真アップロード確定ユースケースを生成する高階関数。
 *
 * @param issueRepo - IssueRepository インターフェース
 * @param blobStorage - BlobStorage インターフェース
 * @returns ユースケース関数
 */
export const confirmPhotoUploadUseCase =
  (issueRepo: IssueRepository, blobStorage: BlobStorage) =>
  async (
    input: ConfirmPhotoUploadInput,
  ): Promise<Result<void, DomainErrorDetail>> => {
    const issue = await issueRepo.load(input.issueId);
    if (!issue) {
      return err({
        code: "ISSUE_NOT_FOUND",
        message: `Issue not found: ${input.issueId}`,
      });
    }

    // ファイル拡張子を検証
    const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!ext) {
      return err({
        code: "INVALID_FILE_EXTENSION",
        message: "File name must have an extension",
      });
    }

    // confirmed パスで Photo を作成（イベントには最終パスを記録する）
    const confirmedPath = confirmedBlobPath(
      input.issueId,
      input.phase,
      input.photoId,
      ext,
    );
    const photo = createPhoto({
      id: input.photoId,
      fileName: input.fileName,
      storagePath: confirmedPath,
      phase: input.phase,
      uploadedAt: new Date(),
    });

    // PhotoAdded イベントを生成（confirmed パスで記録）
    const eventResult = addPhoto(issue, photo, input.actorId);
    if (!eventResult.ok) return eventResult;

    // イベントを先に永続化（データ整合性優先）
    try {
      await issueRepo.save(input.issueId, [eventResult.value], issue.version);
    } catch (error) {
      if (error instanceof ConcurrencyError) {
        return err({ code: "CONCURRENCY_CONFLICT", message: error.message });
      }
      return err({
        code: "SAVE_FAILED",
        message: `Failed to save issue: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // pending → confirmed に移動（blob 操作には pending パスが必要）
    const pendingPhoto = createPhoto({
      ...photo,
      storagePath: pendingBlobPath(input.issueId, input.photoId, ext),
    });
    try {
      await blobStorage.confirmPending(input.issueId, [pendingPhoto]);
    } catch (error) {
      return err({
        code: "CONFIRM_FAILED",
        message: `Failed to confirm pending photo: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return { ok: true, value: undefined };
  };
