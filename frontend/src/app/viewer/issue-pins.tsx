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
}

export function IssuePinsOverlay({
  positions,
  selectedPin,
  onPinClick,
  onClose,
}: IssuePinsOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {positions.map(
        ({ pin, x, y, visible }) =>
          visible && (
            <button
              key={pin.id}
              type="button"
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
        />
      )}
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
}: {
  pin: IssuePin;
  position: PinPosition | undefined;
  onClose: () => void;
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
        <div className="px-3 py-2 border-t border-zinc-100">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bg} text-zinc-700`}
          >
            <span
              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[pin.status].color}`}
            />
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
