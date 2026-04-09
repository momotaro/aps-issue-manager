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
    <div className="w-[480px] rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 border-b border-zinc-200 h-12">
        <h3 className="text-sm font-semibold text-zinc-900">写真比較</h3>
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

      {/* 是正前 */}
      <div className="p-4 border-b border-zinc-200">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[13px] font-semibold text-zinc-900">
              是正前
            </span>
          </div>
          {beforePhotos.length > 0 && (
            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
              {beforePhotos.length}枚
            </span>
          )}
        </div>
        {beforePhotos.length > 0 ? (
          <PhotoGrid
            photos={beforePhotos}
            onPhotoClick={(photo) => onPhotoClick(getGlobalIndex(photo))}
          />
        ) : (
          <div className="flex items-center justify-center h-[88px] rounded-md bg-zinc-100 text-zinc-400 text-sm">
            写真なし
          </div>
        )}
      </div>

      {/* 是正後 */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[13px] font-semibold text-zinc-900">
              是正後
            </span>
          </div>
          {afterPhotos.length > 0 && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
              {afterPhotos.length}枚
            </span>
          )}
        </div>
        {afterPhotos.length > 0 ? (
          <PhotoGrid
            photos={afterPhotos}
            onPhotoClick={(photo) => onPhotoClick(getGlobalIndex(photo))}
          />
        ) : (
          <div className="flex items-center justify-center h-[88px] rounded-md bg-zinc-100 text-zinc-400 text-sm">
            写真なし
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoGrid({
  photos,
  onPhotoClick,
}: {
  photos: PhotoItem[];
  onPhotoClick: (photo: PhotoItem) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((photo) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onPhotoClick(photo)}
          className="h-[88px] w-[88px] shrink-0 rounded-md overflow-hidden bg-zinc-200 hover:opacity-90 transition-opacity"
        >
          {/* biome-ignore lint/performance/noImgElement: external MinIO URL */}
          <img
            src={getPhotoUrl(photo.storagePath)}
            alt={photo.fileName}
            className="h-full w-full object-cover"
          />
        </button>
      ))}
    </div>
  );
}
