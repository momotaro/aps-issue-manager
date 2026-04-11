"use client";

import { useCallback, useEffect } from "react";
import { formatDateTime } from "@/lib/format-date-time";
import { getPhotoUrl } from "@/lib/photo-url";

/** `actorColor` を `#RRGGBB` に限定するガード。不正値は gray フォールバック。 */
const safeHexColor = (color: string | undefined): string =>
  color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#9CA3AF";

/** Lightbox で表示する写真（Timeline のコメント添付 or 送信前 preview）。 */
export type LightboxPhoto = {
  id: string;
  fileName: string;
  /** 表示に使う URL。object URL（pending）または getPhotoUrl(storagePath) の結果。 */
  src: string;
  /** 投稿者名。コメントコンテキストがない場合は undefined。 */
  actorName?: string;
  /** 投稿者アバター色（`#RRGGBB`）。コメントコンテキストがない場合は undefined。 */
  actorColor?: string;
  /** 投稿日時（ISO 8601）。コメントコンテキストがない場合は undefined。 */
  createdAt?: string;
  /** コメント本文。コメントコンテキストがない場合は undefined。 */
  commentBody?: string;
};

type PhotoLightboxProps = {
  photos: readonly LightboxPhoto[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

/** コメントコンテキスト（情報パネルに表示する投稿者・日時・本文）。 */
export type CommentContext = {
  actorName: string;
  actorColor: string;
  createdAt: string;
  commentBody: string;
};

/** 添付の `storagePath` を入力に LightboxPhoto を組み立てるヘルパー。 */
export const toLightboxPhotoFromStoragePath = (
  id: string,
  fileName: string,
  storagePath: string,
  commentContext?: CommentContext,
): LightboxPhoto => ({
  id,
  fileName,
  src: getPhotoUrl(storagePath),
  ...commentContext,
});

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

      {/* コンテンツカード */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation only */}
      <div
        className="relative z-10 flex max-w-[90vw] flex-col gap-3 rounded-xl bg-neutral-900 p-4 max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 閉じるボタン */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
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

        {/* 画像 */}
        {/* biome-ignore lint/performance/noImgElement: external MinIO URL / object URL */}
        <img
          src={photo.src}
          alt={photo.fileName}
          className="w-full max-h-[65vh] rounded-lg object-contain"
        />

        {/* 情報パネル（lbInfoPanel）: 投稿者・日時・コメント本文 */}
        {photo.actorName && photo.createdAt && (
          <div className="flex items-start gap-3 rounded-lg bg-white/[0.08] p-3.5">
            <div
              className="h-8 w-8 shrink-0 rounded-full"
              style={{ backgroundColor: safeHexColor(photo.actorColor) }}
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-white">
                  {photo.actorName}
                </span>
                <span className="text-[11px] text-white/70">
                  {formatDateTime(photo.createdAt)}
                </span>
              </div>
              {photo.commentBody && (
                <p className="break-words whitespace-pre-wrap text-[12px] leading-relaxed text-white/80">
                  {photo.commentBody}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ページネーション: [←] N / M [→] */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={!hasPrev}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:invisible"
            aria-label="前の写真"
          >
            <svg
              className="w-4 h-4"
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

          <span className="min-w-[3ch] text-center text-sm font-medium text-white/50">
            {currentIndex + 1} / {photos.length}
          </span>

          <button
            type="button"
            onClick={handleNext}
            disabled={!hasNext}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:invisible"
            aria-label="次の写真"
          >
            <svg
              className="w-4 h-4"
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
        </div>
      </div>
    </div>
  );
}
