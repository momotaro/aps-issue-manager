import type { IssueCategory, IssueStatus } from "@/types/issue";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/types/issue";

type Props = {
  status: IssueStatus | undefined;
  category: IssueCategory | undefined;
  onStatusChange: (value: IssueStatus | undefined) => void;
  onCategoryChange: (value: IssueCategory | undefined) => void;
};

export function IssueFilterBar({
  status,
  category,
  onStatusChange,
  onCategoryChange,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={status ?? ""}
        onChange={(e) =>
          onStatusChange((e.target.value as IssueStatus) || undefined)
        }
        className="h-9 px-3 text-[13px] text-zinc-600 border border-zinc-200 rounded-lg bg-white outline-none"
      >
        <option value="">ステータス</option>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={category ?? ""}
        onChange={(e) =>
          onCategoryChange((e.target.value as IssueCategory) || undefined)
        }
        className="h-9 px-3 text-[13px] text-zinc-600 border border-zinc-200 rounded-lg bg-white outline-none"
      >
        <option value="">種別</option>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
