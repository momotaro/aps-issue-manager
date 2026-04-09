import { getPhotoUrl } from "@/lib/photo-url";
import type { IssueDetail } from "@/repositories/issue-repository";
import { CATEGORY_LABELS, type IssuePin, type IssueStatus } from "./types";

const STATUS_CONFIG: Record<
  IssueStatus,
  { color: string; bg: string; label: string }
> = {
  open: { color: "bg-red-500", bg: "bg-red-50", label: "未対応" },
  in_progress: {
    color: "bg-amber-500",
    bg: "bg-amber-50",
    label: "対応中",
  },
  in_review: { color: "bg-blue-500", bg: "bg-blue-50", label: "レビュー中" },
  done: { color: "bg-emerald-500", bg: "bg-emerald-50", label: "完了" },
};

interface PinPosition {
  pin: IssuePin;
  x: number;
  y: number;
  visible: boolean;
}

interface IssuePinsOverlayProps {
  positions: PinPosition[];
  selectedPin: IssuePin | null;
  onPinClick: (pin: IssuePin) => void;
  onClose: () => void;
  onComparePhotos?: (issueId: string) => void;
  onEdit?: (issueId: string) => void;
  issueDetail?: IssueDetail | null;
}

export function IssuePinsOverlay({
  positions,
  selectedPin,
  onPinClick,
  onClose,
  onComparePhotos,
  onEdit,
  issueDetail,
}: IssuePinsOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {positions.map(
        ({ pin, x, y, visible }) =>
          visible && (
            <button
              key={pin.id}
              type="button"
              aria-label={`指摘: ${pin.title}`}
              className="absolute pointer-events-auto -translate-x-1/2 -translate-y-full group"
              style={{ left: x, top: y }}
              onClick={() => onPinClick(pin)}
            >
              <PinMarker status={pin.status} />
            </button>
          ),
      )}

      {selectedPin && (
        <PinPopup
          pin={selectedPin}
          position={positions.find((p) => p.pin.id === selectedPin.id)}
          onClose={onClose}
          onComparePhotos={onComparePhotos}
          onEdit={onEdit}
          issueDetail={issueDetail}
        />
      )}
    </div>
  );
}

export function PendingPinMarker() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-10 w-10 rounded-full bg-[#E5E7EB] ring-2 ring-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
        <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9CA3AF]" />
        <svg
          className="absolute right-0 top-0 h-3.5 w-3.5 text-[#374151]"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
        </svg>
      </div>
      <div className="h-2 w-0.5 bg-[#9CA3AF]" />
    </div>
  );
}

export function EditingPinMarker({ status }: { status: IssueStatus }) {
  const { color } = STATUS_CONFIG[status];
  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative flex h-8 w-8 items-center justify-center rounded-full ${color} shadow-lg ring-2 ring-white`}
      >
        <svg
          className="h-4 w-4 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-label="指摘ピン"
          role="img"
        >
          <path
            fillRule="evenodd"
            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
            clipRule="evenodd"
          />
        </svg>
        {/* 編集中バッジ */}
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow ring-1 ring-zinc-200">
          <svg
            className="h-2.5 w-2.5 text-zinc-700"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
          </svg>
        </span>
      </div>
      <div className={`h-2 w-0.5 ${color}`} />
    </div>
  );
}

export function PinMarker({ status }: { status: IssueStatus }) {
  const { color } = STATUS_CONFIG[status];
  return (
    <div className="flex flex-col items-center">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full ${color} shadow-lg ring-2 ring-white transition-transform hover:scale-110`}
      >
        <svg
          className="h-4 w-4 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-label="指摘ピン"
          role="img"
        >
          <path
            fillRule="evenodd"
            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className={`h-2 w-0.5 ${color}`} />
    </div>
  );
}

function PinPopup({
  pin,
  position,
  onClose,
  onComparePhotos,
  onEdit,
  issueDetail,
}: {
  pin: IssuePin;
  position: PinPosition | undefined;
  onClose: () => void;
  onComparePhotos?: (issueId: string) => void;
  onEdit?: (issueId: string) => void;
  issueDetail?: IssueDetail | null;
}) {
  if (!position?.visible) return null;

  const { bg, label } = STATUS_CONFIG[pin.status];
  const categoryLabel = CATEGORY_LABELS[pin.category];

  // 写真は before 優先で最大2枚
  const photos = issueDetail?.photos ?? [];
  const beforePhotos = photos.filter((p) => p.phase === "before");
  const afterPhotos = photos.filter((p) => p.phase === "after");
  const thumbnails = [...beforePhotos, ...afterPhotos].slice(0, 2);
  const hasPhotos = photos.length > 0;

  return (
    <div
      className="absolute pointer-events-auto -translate-x-1/2 mb-2"
      style={{ left: position.x, top: position.y - 56 }}
    >
      <div className="w-[280px] rounded-lg bg-white shadow-xl ring-1 ring-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-900 truncate pr-2">
            {pin.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="shrink-0 text-zinc-400 hover:text-zinc-600"
          >
            <svg
              className="h-4 w-4"
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

        {/* Body */}
        <div className="px-3 py-3 space-y-3">
          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bg} text-zinc-700`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[pin.status].color}`}
              />
              {label}
            </span>
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {categoryLabel}
            </span>
          </div>

          {/* Description */}
          {issueDetail?.description && (
            <p className="text-xs text-zinc-500 line-clamp-3 leading-relaxed">
              {issueDetail.description}
            </p>
          )}

          {/* Photos */}
          {hasPhotos && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-700">写真</span>
                {onComparePhotos && (
                  <button
                    type="button"
                    onClick={() => onComparePhotos(pin.id)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    全て表示 →
                  </button>
                )}
              </div>
              <div className="flex gap-1.5">
                {thumbnails.map((photo) => (
                  <img
                    key={photo.id}
                    src={getPhotoUrl(photo.storagePath)}
                    alt={photo.fileName}
                    className="h-[60px] w-[60px] rounded object-cover bg-zinc-200"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Show compare link even when no photos loaded but photoCount > 0 */}
          {!hasPhotos && pin.photoCount > 0 && onComparePhotos && (
            <button
              type="button"
              onClick={() => onComparePhotos(pin.id)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
              {pin.photoCount}枚
            </button>
          )}
        </div>

        {/* Footer */}
        {onEdit && (
          <div className="px-3 py-2.5 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => onEdit(pin.id)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                />
              </svg>
              編集
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function PlacementModeOverlay() {
  return (
    <div className="absolute top-0 inset-x-0 z-30 pointer-events-none">
      <div className="flex items-center gap-3 px-4 h-10 bg-[rgba(15,23,42,0.85)]">
        <svg
          className="h-4 w-4 text-white shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 2v4m0 12v4M2 12h4m12 0h4m-4.93-6.07-2.83 2.83M6.76 17.24l-2.83 2.83M17.24 17.24l2.83 2.83M6.76 6.76 3.93 3.93"
          />
        </svg>
        <span className="text-[13px] font-medium text-white">
          クリックでピンを配置
        </span>
        <div className="w-px h-5 bg-white/30" />
        <span className="text-[12px] text-white/60">ESC でキャンセル</span>
      </div>
    </div>
  );
}
