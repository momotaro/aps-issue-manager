"use client";

import type { IssueListItem } from "@/repositories/issue-repository";
import { IssueCard } from "./issue-card";
import { IssueFilter } from "./issue-filter";
import type { IssueCategory, IssueStatus } from "./types";

interface IssueListPanelProps {
  issues: IssueListItem[];
  isLoading: boolean;
  statusFilter: IssueStatus | undefined;
  categoryFilter: IssueCategory | undefined;
  onStatusChange: (status: IssueStatus | undefined) => void;
  onCategoryChange: (category: IssueCategory | undefined) => void;
  onAddClick: () => void;
  onClose: () => void;
  onCardClick: (issue: IssueListItem) => void;
}

export function IssueListPanel({
  issues,
  isLoading,
  statusFilter,
  categoryFilter,
  onStatusChange,
  onCategoryChange,
  onAddClick,
  onClose,
  onCardClick,
}: IssueListPanelProps) {
  return (
    <div className="w-80 border-l border-zinc-200 bg-white shrink-0 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-zinc-200 shrink-0">
        <span className="text-sm font-semibold text-zinc-900">指摘一覧</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddClick}
            className="flex items-center justify-center w-7 h-7 rounded-md bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
            aria-label="指摘を追加"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="一覧パネルを閉じる"
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
                d="M9 3h6a2 2 0 012 2v14a2 2 0 01-2 2H9m0-18a2 2 0 00-2 2v14a2 2 0 002 2m0-18v18m8-9h-4"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <IssueFilter
        status={statusFilter}
        category={categoryFilter}
        onStatusChange={onStatusChange}
        onCategoryChange={onCategoryChange}
      />

      {/* Card List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {isLoading ? (
          <p className="text-xs text-zinc-400 text-center py-8">
            読み込み中...
          </p>
        ) : issues.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-8">
            指摘がありません
          </p>
        ) : (
          issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onClick={onCardClick} />
          ))
        )}
      </div>
    </div>
  );
}
