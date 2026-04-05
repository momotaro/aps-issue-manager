"use client";

import { useCallback, useRef, useState } from "react";
import { getPhotoUrl } from "@/lib/photo-url";
import type { PhotoItem, PhotoPhase } from "@/repositories/issue-repository";
import type { StagedFile, UploadingPhoto } from "./photo-upload.hooks";

type PhotoUploaderProps = {
  phase: PhotoPhase;
  onPhaseChange: (phase: PhotoPhase) => void;
  onFilesSelected: (files: File[], phase: PhotoPhase) => void;
  uploading: UploadingPhoto[];
  staged?: StagedFile[];
  photos: PhotoItem[];
  onDeletePhoto: (photoId: string) => void;
  onRemoveStaged?: (index: number) => void;
  onPhotoClick: (index: number) => void;
  isDeletePending?: boolean;
};

export function PhotoUploader({
  phase,
  onPhaseChange,
  onFilesSelected,
  uploading,
  staged = [],
  photos,
  onDeletePhoto,
  onRemoveStaged,
  onPhotoClick,
  isDeletePending = false,
}: PhotoUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUploading = uploading.filter((p) => p.phase === phase);
  const currentStaged = staged.filter((s) => s.phase === phase);
  const currentPhotos = photos.filter((p) => p.phase === phase);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesSelected(files, phase);
      }
    },
    [onFilesSelected, phase],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        onFilesSelected(files, phase);
      }
      e.target.value = "";
    },
    [onFilesSelected, phase],
  );

  const handleZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Calculate the starting index for current phase photos in the full list
  const allPhotos = photos;
  const getGlobalIndex = (localIndex: number) => {
    const photo = currentPhotos[localIndex];
    return allPhotos.findIndex((p) => p.id === photo.id);
  };

  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-zinc-700">写真</span>

      {/* Phase Tabs */}
      <div className="flex h-8 rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => onPhaseChange("before")}
          className={`flex-1 flex items-center justify-center text-xs font-semibold rounded-md transition-colors ${
            phase === "before"
              ? "bg-zinc-900 text-white"
              : "border border-zinc-300 text-zinc-500"
          }`}
        >
          是正前
        </button>
        <button
          type="button"
          onClick={() => onPhaseChange("after")}
          className={`flex-1 flex items-center justify-center text-xs font-medium rounded-md transition-colors ${
            phase === "after"
              ? "bg-zinc-900 text-white"
              : "border border-zinc-300 text-zinc-500"
          }`}
        >
          是正後
        </button>
      </div>

      {/* Drop Zone */}
      <button
        type="button"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleZoneClick}
        className={`flex flex-col items-center justify-center w-full h-24 rounded-md border transition-colors cursor-pointer ${
          isDragOver
            ? "border-zinc-500 bg-zinc-50"
            : "border-zinc-300 hover:border-zinc-400"
        }`}
      >
        <svg
          className="h-7 w-7 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
        <span className="text-xs text-zinc-400 mt-1 text-center">
          ドラッグ&ドロップ
          <br />
          またはクリックして選択
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Thumbnails */}
      {(currentStaged.length > 0 ||
        currentUploading.length > 0 ||
        currentPhotos.length > 0) && (
        <div className="flex gap-2 flex-wrap">
          {currentPhotos.map((photo, idx) => (
            <PhotoThumbnail
              key={photo.id}
              src={getPhotoUrl(photo.storagePath)}
              fileName={photo.fileName}
              onDelete={() => onDeletePhoto(photo.id)}
              onClick={() => onPhotoClick(getGlobalIndex(idx))}
              isDeletePending={isDeletePending}
            />
          ))}
          {currentStaged.map((s) => {
            const globalIndex = staged.indexOf(s);
            return (
              <PhotoThumbnail
                key={s.previewUrl}
                src={s.previewUrl}
                fileName={s.file.name}
                onDelete={() => onRemoveStaged?.(globalIndex)}
                onClick={() => {}}
                isDeletePending={false}
              />
            );
          })}
          {currentUploading.map((photo) => (
            <UploadingThumbnail
              key={photo.localId}
              previewUrl={photo.previewUrl}
              progress={photo.progress}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoThumbnail({
  src,
  fileName,
  onDelete,
  onClick,
  isDeletePending,
}: {
  src?: string;
  fileName: string;
  onDelete: () => void;
  onClick: () => void;
  isDeletePending: boolean;
}) {
  return (
    <div className="relative w-16 h-16 group">
      <button
        type="button"
        onClick={onClick}
        className="w-full h-full rounded-md bg-zinc-700 overflow-hidden"
      >
        {src ? (
          // biome-ignore lint/performance/noImgElement: external MinIO URL
          <img
            src={src}
            alt={fileName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-zinc-700" />
        )}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={isDeletePending}
        className="absolute -top-1 -right-1 flex items-center justify-center w-[18px] h-[18px] rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
        aria-label={`${fileName}を削除`}
      >
        <svg
          className="w-2.5 h-2.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

function UploadingThumbnail({
  previewUrl,
  progress,
}: {
  previewUrl: string;
  progress: number;
}) {
  return (
    <div className="relative w-16 h-16 rounded-md overflow-hidden bg-zinc-700">
      {/* Grayed-out preview */}
      {/* biome-ignore lint/performance/noImgElement: local ObjectURL preview */}
      <img
        src={previewUrl}
        alt="アップロード中"
        className="w-full h-full object-cover opacity-40 grayscale"
      />
      {/* Progress percentage overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white text-xs font-semibold drop-shadow-md">
          {progress}%
        </span>
      </div>
      {/* Progress bar — bottom, 3px height, blue */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-zinc-600">
        <div
          className="h-full bg-blue-500 rounded-sm transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
