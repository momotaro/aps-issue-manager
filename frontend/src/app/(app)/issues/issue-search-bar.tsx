type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function IssueSearchBar({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 w-80 h-9 px-3 bg-zinc-50 border border-zinc-200 rounded-lg">
      <svg
        className="h-4 w-4 text-zinc-400 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="タイトル・説明で検索…"
        className="flex-1 bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-zinc-400 hover:text-zinc-600"
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
      )}
    </div>
  );
}
