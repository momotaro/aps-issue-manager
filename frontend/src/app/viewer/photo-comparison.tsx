"use client";

import { getPhotoUrl } from "@/lib/photo-url";
import type { PhotoItem } from "@/repositories/issue-repository";

type PhotoComparisonProps = {
  photos: PhotoItem[];
  onClose: () => void;
  onPhotoClick: (index: number) => void;
};

export function PhotoComparison({
  photos,
  onClose,
  onPhotoClick,
}: PhotoComparisonProps) {
  const beforePhotos = photos.filter((p) => p.phase === "before");
  const afterPhotos = photos.filter((p) => p.phase === "after");

  const getGlobalIndex = (photo: PhotoItem) =>
    photos.findIndex((p) => p.id === photo.id);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-zinc-900">写真比較</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600"
          aria-label="閉じる"
        >
          <svg
            className="w-5 h-5"
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
      </div>

      {/* Columns */}
      <div className="flex gap-4">
        {/* Before */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm font-semibold text-zinc-900">是正前</span>
          </div>
          {beforePhotos.length > 0 ? (
            <div className="space-y-2">
              {beforePhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onPhotoClick(getGlobalIndex(photo))}
                  className="w-full rounded-lg overflow-hidden bg-zinc-800"
                >
                  {/* biome-ignore lint/performance/noImgElement: external MinIO URL */}
                  <img
                    src={getPhotoUrl(photo.storagePath)}
                    alt={photo.fileName}
                    className="w-full h-44 object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-44 rounded-lg bg-zinc-100 text-zinc-400 text-sm">
              写真なし
            </div>
          )}
        </div>

        {/* After */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold text-zinc-900">是正後</span>
          </div>
          {afterPhotos.length > 0 ? (
            <div className="space-y-2">
              {afterPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onPhotoClick(getGlobalIndex(photo))}
                  className="w-full rounded-lg overflow-hidden bg-zinc-800"
                >
                  {/* biome-ignore lint/performance/noImgElement: external MinIO URL */}
                  <img
                    src={getPhotoUrl(photo.storagePath)}
                    alt={photo.fileName}
                    className="w-full h-44 object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-44 rounded-lg bg-zinc-100 text-zinc-400 text-sm">
              写真なし
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
