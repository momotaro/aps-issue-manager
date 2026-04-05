"use client";

import {
  CATEGORY_LABELS,
  type IssueCategory,
  type IssueStatus,
  STATUS_LABELS,
} from "./types";

interface IssueFilterProps {
  status: IssueStatus | undefined;
  category: IssueCategory | undefined;
  onStatusChange: (status: IssueStatus | undefined) => void;
  onCategoryChange: (category: IssueCategory | undefined) => void;
}

export function IssueFilter({
  status,
  category,
  onStatusChange,
  onCategoryChange,
}: IssueFilterProps) {
  return (
    <div className="flex gap-2 px-4 py-2">
      <select
        value={status ?? ""}
        onChange={(e) =>
          onStatusChange(
            e.target.value ? (e.target.value as IssueStatus) : undefined,
          )
        }
        className="h-[30px] rounded-md border border-zinc-200 px-2.5 text-[11px] text-zinc-400 bg-white"
      >
        <option value="">ステータス</option>
        {(Object.entries(STATUS_LABELS) as [IssueStatus, string][]).map(
          ([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ),
        )}
      </select>
      <select
        value={category ?? ""}
        onChange={(e) =>
          onCategoryChange(
            e.target.value ? (e.target.value as IssueCategory) : undefined,
          )
        }
        className="h-[30px] rounded-md border border-zinc-200 px-2.5 text-[11px] text-zinc-400 bg-white"
      >
        <option value="">種別</option>
        {(Object.entries(CATEGORY_LABELS) as [IssueCategory, string][]).map(
          ([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ),
        )}
      </select>
    </div>
  );
}
