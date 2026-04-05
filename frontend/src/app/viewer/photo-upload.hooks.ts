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

function uploadToPresignedUrl(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    const abortHandler = () => {
      xhr.abort();
      reject(new DOMException("Upload aborted", "AbortError"));
    };
    signal.addEventListener("abort", abortHandler);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      signal.removeEventListener("abort", abortHandler);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      signal.removeEventListener("abort", abortHandler);
      reject(new Error("Upload failed"));
    };

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

export function usePhotoUpload(issueId: string | null, actorId: string) {
  const [uploading, setUploading] = useState<UploadingPhoto[]>([]);
  const [errors, setErrors] = useState<FileValidationError[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadingRef = useRef(uploading);
  uploadingRef.current = uploading;
  const queryClient = useQueryClient();

  const uploadFiles = useCallback(
    async (files: File[], phase: PhotoPhase) => {
      if (!issueId) return;

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

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      for (const file of validFiles) {
        const localId = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);

        const uploadingPhoto: UploadingPhoto = {
          localId,
          fileName: file.name,
          phase,
          progress: 0,
          previewUrl,
        };

        setUploading((prev) => [...prev, uploadingPhoto]);

        try {
          if (controller.signal.aborted) break;

          const { photoId, uploadUrl } =
            await issueRepository.generatePhotoUploadUrl(
              issueId,
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

          await issueRepository.confirmPhotoUpload(
            issueId,
            photoId,
            file.name,
            phase,
            actorId,
          );

          setUploading((prev) => prev.filter((p) => p.localId !== localId));
          URL.revokeObjectURL(previewUrl);

          queryClient.invalidateQueries({
            queryKey: ISSUE_DETAIL_KEY(issueId),
          });
          queryClient.invalidateQueries({ queryKey: ["issues"] });
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
    [issueId, actorId, queryClient],
  );

  const clearErrors = useCallback(() => setErrors([]), []);

  const cleanup = useCallback(() => {
    abortControllerRef.current?.abort();
    for (const photo of uploadingRef.current) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    setUploading([]);
    setErrors([]);
  }, []);

  return { uploading, errors, uploadFiles, clearErrors, cleanup };
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
