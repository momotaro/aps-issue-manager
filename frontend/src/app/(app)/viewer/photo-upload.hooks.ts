"use client";

/**
 * Composer 用の写真アップロードフック。
 *
 * @remarks
 * ユースケース指向 API ではコメント送信時に `attachments` 配列を含めることで
 * 写真とコメントを一括登録する。pending → confirmed の移動は backend useCase
 * （`correctIssueUseCase` / `addCommentUseCase` 等）内で自動実行されるため、
 * フロントから confirm API を呼ぶ必要はない。
 *
 * 使い方:
 * - Composer は draft ごとに `commentId` を生成し、このフックに渡す
 * - `addFiles(files[])` で選択されたファイルを即座にアップロード開始
 * - 成功したものは `attachments` に追加される
 * - コメント送信時に `attachments` をそのまま mutation に渡す
 * - 送信成功後は `clear()` を呼ぶ
 */

import { useCallback, useRef, useState } from "react";
import { issueRepository } from "@/repositories/issue-repository";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export type UploadingPhoto = {
  localId: string;
  fileName: string;
  progress: number;
  previewUrl: string;
};

/** pending 状態の添付写真。コメント送信時にそのまま送る。 */
export type PendingAttachment = {
  id: string;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
  /** UI 表示用の preview URL（object URL）。送信には含めない。 */
  previewUrl: string;
};

export type FileValidationError = {
  fileName: string;
  reason: "size" | "type" | "upload";
};

export function validateFile(file: File): FileValidationError | null {
  if (!file.type.startsWith("image/")) {
    return { fileName: file.name, reason: "type" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { fileName: file.name, reason: "size" };
  }
  return null;
}

/** @internal テスト用にエクスポート */
export function uploadToPresignedUrl(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abortHandler);
      fn();
    };

    const abortHandler = () => {
      xhr.abort();
      settle(() => reject(new DOMException("Upload aborted", "AbortError")));
    };
    signal.addEventListener("abort", abortHandler);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        settle(() => resolve());
      } else {
        settle(() =>
          reject(new Error(`Upload failed with status ${xhr.status}`)),
        );
      }
    };

    xhr.onerror = () => {
      settle(() => reject(new Error("Upload failed")));
    };

    xhr.onabort = () => {
      settle(() => reject(new DOMException("Upload aborted", "AbortError")));
    };

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

/**
 * Composer の draft に紐づく写真アップロードフック。
 *
 * @param issueId - 対象 Issue の ID（新規作成時も既にクライアント側で決めておく）
 * @param commentId - draft コメントの ID（Composer 側で生成してセット）
 */
export function usePhotoUpload(
  issueId: string | null,
  commentId: string | null,
) {
  const [uploading, setUploading] = useState<UploadingPhoto[]>([]);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [errors, setErrors] = useState<FileValidationError[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadingRef = useRef(uploading);
  uploadingRef.current = uploading;
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const doUpload = useCallback(
    async (targetIssueId: string, targetCommentId: string, files: File[]) => {
      const controller =
        abortControllerRef.current && !abortControllerRef.current.signal.aborted
          ? abortControllerRef.current
          : new AbortController();
      abortControllerRef.current = controller;

      for (const file of files) {
        const localId = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);

        setUploading((prev) => [
          ...prev,
          { localId, fileName: file.name, progress: 0, previewUrl },
        ]);

        try {
          if (controller.signal.aborted) break;

          // storagePath は backend から返される pending/{...}（base62 ではなく実 MinIO キー）
          const { photoId, uploadUrl, storagePath } =
            await issueRepository.generatePhotoUploadUrl(
              targetIssueId,
              targetCommentId,
              file.name,
            );

          await uploadToPresignedUrl(
            uploadUrl,
            file,
            (progress) => {
              setUploading((prev) =>
                prev.map((p) =>
                  p.localId === localId ? { ...p, progress } : p,
                ),
              );
            },
            controller.signal,
          );

          // アップロード完了 → attachments に追加
          setUploading((prev) => prev.filter((p) => p.localId !== localId));
          setAttachments((prev) => [
            ...prev,
            {
              id: photoId,
              fileName: file.name,
              storagePath,
              uploadedAt: new Date().toISOString(),
              previewUrl,
            },
          ]);
        } catch (error) {
          URL.revokeObjectURL(previewUrl);
          setUploading((prev) => prev.filter((p) => p.localId !== localId));

          if (error instanceof DOMException && error.name === "AbortError") {
            break;
          }
          setErrors((prev) => [
            ...prev,
            { fileName: file.name, reason: "upload" },
          ]);
        }
      }
    },
    [],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const validationErrors: FileValidationError[] = [];
      const validFiles: File[] = [];

      for (const file of files) {
        const error = validateFile(file);
        if (error) {
          validationErrors.push(error);
        } else {
          validFiles.push(file);
        }
      }

      if (validationErrors.length > 0) {
        setErrors((prev) => [...prev, ...validationErrors]);
      }

      if (!issueId || !commentId || validFiles.length === 0) return;

      doUpload(issueId, commentId, validFiles);
    },
    [issueId, commentId, doUpload],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clearErrors = useCallback(() => setErrors([]), []);

  /** 送信成功後に Composer から呼ぶ。attachments と uploading 状態をリセットする。 */
  const clear = useCallback(() => {
    for (const a of attachmentsRef.current) {
      URL.revokeObjectURL(a.previewUrl);
    }
    for (const u of uploadingRef.current) {
      URL.revokeObjectURL(u.previewUrl);
    }
    setAttachments([]);
    setUploading([]);
    setErrors([]);
  }, []);

  /** アンマウント時のクリーンアップ（アップロード中のものは abort）。 */
  const cleanup = useCallback(() => {
    abortControllerRef.current?.abort();
    for (const a of attachmentsRef.current) {
      URL.revokeObjectURL(a.previewUrl);
    }
    for (const u of uploadingRef.current) {
      URL.revokeObjectURL(u.previewUrl);
    }
    setAttachments([]);
    setUploading([]);
    setErrors([]);
  }, []);

  return {
    uploading,
    attachments,
    errors,
    addFiles,
    removeAttachment,
    clearErrors,
    clear,
    cleanup,
  };
}
