"use client";

interface ListToggleBarProps {
  onOpen: () => void;
}

export function ListToggleBar({ onOpen }: ListToggleBarProps) {
  return (
    <div className="w-9 border-l border-zinc-200 bg-white shrink-0 pt-[15px] flex flex-col items-center">
      <button
        type="button"
        onClick={onOpen}
        aria-label="指摘一覧を表示"
        className="text-zinc-400 hover:text-zinc-600 transition-colors"
      >
        <svg
          className="h-[18px] w-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 3h6a2 2 0 012 2v14a2 2 0 01-2 2H9m0-18a2 2 0 00-2 2v14a2 2 0 002 2m0-18v18m-4-9h4"
          />
        </svg>
      </button>
    </div>
  );
}
