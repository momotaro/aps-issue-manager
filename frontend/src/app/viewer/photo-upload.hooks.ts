"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type { PhotoPhase } from "@/repositories/issue-repository";
import { issueRepository } from "@/repositories/issue-repository";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export type UploadingPhoto = {
  localId: string;
  fileName: string;
  phase: PhotoPhase;
  progress: number;
  previewUrl: string;
};

export type PendingConfirm = {
  photoId: string;
  fileName: string;
  phase: PhotoPhase;
  previewUrl: string;
};

export type FileValidationError = {
  fileName: string;
  reason: "size" | "type" | "upload";
};

const ISSUE_DETAIL_KEY = (id: string) => ["issue-detail", id] as const;

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

export function usePhotoUpload(issueId: string | null, actorId: string) {
  const [uploading, setUploading] = useState<UploadingPhoto[]>([]);
  const [pendingConfirms, setPendingConfirms] = useState<PendingConfirm[]>([]);
  const [errors, setErrors] = useState<FileValidationError[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadingRef = useRef(uploading);
  uploadingRef.current = uploading;
  const pendingConfirmsRef = useRef(pendingConfirms);
  pendingConfirmsRef.current = pendingConfirms;
  const queryClient = useQueryClient();

  const doUpload = useCallback(
    async (targetIssueId: string, files: File[], phase: PhotoPhase) => {
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
          { localId, fileName: file.name, phase, progress: 0, previewUrl },
        ]);

        try {
          if (controller.signal.aborted) break;

          const { photoId, uploadUrl } =
            await issueRepository.generatePhotoUploadUrl(
              targetIssueId,
              file.name,
              phase,
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

          // アップロード完了 → pending confirm に追加（confirm は Issue 作成後）
          setUploading((prev) => prev.filter((p) => p.localId !== localId));
          setPendingConfirms((prev) => [
            ...prev,
            { photoId, fileName: file.name, phase, previewUrl },
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

  // ファイル選択時に即座にアップロード開始
  const addFiles = useCallback(
    (files: File[], phase: PhotoPhase) => {
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

      if (!issueId || validFiles.length === 0) return;

      doUpload(issueId, validFiles, phase);
    },
    [issueId, doUpload],
  );

  // Issue 作成後に全 pending を一括 confirm
  const confirmPending = useCallback(async () => {
    if (!issueId) return;
    const pending = pendingConfirmsRef.current;
    for (const pc of pending) {
      try {
        await issueRepository.confirmPhotoUpload(
          issueId,
          pc.photoId,
          pc.fileName,
          pc.phase,
          actorId,
        );
      } catch {
        // confirm 失敗は致命的ではない — pending ファイルは TTL で自動削除
      }
    }
    // confirm 完了後にプレビュー URL を解放
    for (const pc of pending) {
      URL.revokeObjectURL(pc.previewUrl);
    }
    setPendingConfirms([]);
    queryClient.invalidateQueries({
      queryKey: ISSUE_DETAIL_KEY(issueId),
    });
    queryClient.invalidateQueries({ queryKey: ["issues"] });
  }, [issueId, actorId, queryClient]);

  const clearErrors = useCallback(() => setErrors([]), []);

  const cleanup = useCallback(() => {
    abortControllerRef.current?.abort();
    for (const photo of uploadingRef.current) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    for (const pc of pendingConfirmsRef.current) {
      URL.revokeObjectURL(pc.previewUrl);
    }
    setUploading([]);
    setPendingConfirms([]);
    setErrors([]);
  }, []);

  return {
    uploading,
    pendingConfirms,
    errors,
    addFiles,
    confirmPending,
    clearErrors,
    cleanup,
  };
}

export function useDeletePhoto(issueId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      photoId,
      actorId,
    }: {
      photoId: string;
      actorId: string;
    }) => {
      if (!issueId) throw new Error("issueId is required");
      return issueRepository.removePhoto(issueId, photoId, actorId);
    },
    onSuccess: () => {
      if (issueId) {
        queryClient.invalidateQueries({
          queryKey: ISSUE_DETAIL_KEY(issueId),
        });
        queryClient.invalidateQueries({ queryKey: ["issues"] });
      }
    },
  });
}

export function useIssueDetail(issueId: string | null) {
  return useQuery({
    queryKey: ISSUE_DETAIL_KEY(issueId ?? ""),
    queryFn: () => issueRepository.getIssueDetail(issueId ?? ""),
    enabled: !!issueId,
  });
}
