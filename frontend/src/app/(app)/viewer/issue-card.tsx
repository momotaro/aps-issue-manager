"use client";

import type { IssueListItem } from "@/repositories/issue-repository";
import { CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from "./types";

interface IssueCardProps {
  issue: IssueListItem;
  onClick: (issue: IssueListItem) => void;
}

export function IssueCard({ issue, onClick }: IssueCardProps) {
  const statusColor = STATUS_COLORS[issue.status];
  const categoryLabel = CATEGORY_LABELS[issue.category];
  const statusLabel = STATUS_LABELS[issue.status];
  const date = new Date(issue.createdAt);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <button
      type="button"
      onClick={() => onClick(issue)}
      className="w-full text-left rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center rounded-full px-2 h-5 text-[10px] font-semibold ${statusColor.text} ${statusColor.bg}`}
        >
          {statusLabel}
        </span>
        <span className="text-[10px] text-zinc-400">{categoryLabel}</span>
      </div>
      <p className="mt-1.5 text-[13px] font-medium text-zinc-900 leading-snug">
        {issue.title}
      </p>
      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[11px] text-zinc-400">
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-label="担当者"
            role="img"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span>{issue.assigneeName ?? "未割当"}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          <span className="flex items-center gap-0.5">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-label="写真"
              role="img"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {issue.photoCount}
          </span>
          <span>{dateStr}</span>
        </div>
      </div>
    </button>
  );
}
