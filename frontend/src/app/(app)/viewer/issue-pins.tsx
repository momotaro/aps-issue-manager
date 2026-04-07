import type { IssuePin, IssueStatus } from "./types";

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
}

export function IssuePinsOverlay({
  positions,
  selectedPin,
  onPinClick,
  onClose,
  onComparePhotos,
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
}: {
  pin: IssuePin;
  position: PinPosition | undefined;
  onClose: () => void;
  onComparePhotos?: (issueId: string) => void;
}) {
  if (!position?.visible) return null;

  const { bg, label } = STATUS_CONFIG[pin.status];

  return (
    <div
      className="absolute pointer-events-auto -translate-x-1/2 mb-2"
      style={{ left: position.x, top: position.y - 56 }}
    >
      <div className="w-64 rounded-lg bg-white shadow-xl ring-1 ring-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-900 truncate">
            {pin.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="ml-2 shrink-0 text-zinc-400 hover:text-zinc-600"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-label="閉じる"
              role="img"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-100">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bg} text-zinc-700`}
          >
            <span
              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[pin.status].color}`}
            />
            {label}
          </span>
          {pin.photoCount > 0 && onComparePhotos && (
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
