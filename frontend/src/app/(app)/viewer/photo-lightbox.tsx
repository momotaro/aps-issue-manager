"use client";

import { useCallback, useEffect } from "react";
import { getPhotoUrl } from "@/lib/photo-url";

/** Lightbox で表示する写真（Timeline のコメント添付 or 送信前 preview）。 */
export type LightboxPhoto = {
  id: string;
  fileName: string;
  /** 表示に使う URL。object URL（pending）または getPhotoUrl(storagePath) の結果。 */
  src: string;
};

type PhotoLightboxProps = {
  photos: readonly LightboxPhoto[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

/** 添付の `storagePath` を入力に LightboxPhoto を組み立てるヘルパー。 */
export const toLightboxPhotoFromStoragePath = (
  id: string,
  fileName: string,
  storagePath: string,
): LightboxPhoto => ({ id, fileName, src: getPhotoUrl(storagePath) });

export function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const photo = photos[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handlePrev, handleNext]);

  if (!photo) return null;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled via useEffect
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-label="写真プレビュー"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/80" />

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation only */}
      <div
        className="relative max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="閉じる"
        >
          <svg
            className="w-[18px] h-[18px]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* biome-ignore lint/performance/noImgElement: external MinIO URL / object URL */}
        <img
          src={photo.src}
          alt={photo.fileName}
          className="max-w-[90vw] max-h-[80vh] rounded-lg object-contain"
        />

        {hasPrev && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="前の写真"
          >
            <svg
              className="w-[18px] h-[18px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {hasNext && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="次の写真"
          >
            <svg
              className="w-[18px] h-[18px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium">
          {currentIndex + 1} / {photos.length}
        </p>
      </div>
    </div>
  );
}
