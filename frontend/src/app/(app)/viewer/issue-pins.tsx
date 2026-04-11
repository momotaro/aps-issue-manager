import type { IssuePin, IssueStatus } from "./types";

const STATUS_CONFIG: Record<IssueStatus, { color: string }> = {
  open: { color: "bg-red-500" },
  in_progress: { color: "bg-amber-500" },
  in_review: { color: "bg-blue-500" },
  done: { color: "bg-emerald-500" },
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
}

export function IssuePinsOverlay({
  positions,
  selectedPin,
  onPinClick,
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
              aria-pressed={selectedPin?.id === pin.id}
              className="absolute pointer-events-auto -translate-x-1/2 -translate-y-full group"
              style={{ left: x, top: y }}
              onClick={() => onPinClick(pin)}
            >
              <PinMarker
                status={pin.status}
                highlighted={selectedPin?.id === pin.id}
              />
            </button>
          ),
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

export function PinMarker({
  status,
  highlighted = false,
}: {
  status: IssueStatus;
  highlighted?: boolean;
}) {
  const { color } = STATUS_CONFIG[status];
  const ringClass = highlighted ? "ring-4 ring-blue-300" : "ring-2 ring-white";
  return (
    <div className="flex flex-col items-center">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full ${color} shadow-lg ${ringClass} transition-transform hover:scale-110`}
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
