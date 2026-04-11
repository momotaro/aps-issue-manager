import Link from "next/link";
import type { IssueListItem } from "@/repositories/issue-repository";
import {
  CATEGORY_LABELS,
  type IssueStatus,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/types/issue";
import type { SortBy, SortOrder } from "./issue-search.hooks";

type Props = {
  issues: readonly IssueListItem[];
  isLoading: boolean;
  sortBy: SortBy;
  sortOrder: SortOrder;
  onToggleSort: (column: SortBy) => void;
};

function SortIcon({
  column,
  sortBy,
  sortOrder,
}: {
  column: SortBy;
  sortBy: SortBy;
  sortOrder: SortOrder;
}) {
  const isActive = sortBy === column;
  return (
    <svg
      className={`h-3 w-3 ${isActive ? "text-zinc-700" : "text-zinc-400"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      {isActive && sortOrder === "asc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      ) : isActive && sortOrder === "desc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      )}
    </svg>
  );
}

function StatusBadge({ status }: { status: IssueStatus }) {
  const colors = STATUS_COLORS[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${colors.text} ${colors.bg}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function IssueTable({
  issues,
  isLoading,
  sortBy,
  sortOrder,
  onToggleSort,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-[13px] text-zinc-400">
        読み込み中…
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-[13px] text-zinc-400">
        指摘が見つかりませんでした
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-200">
            <th className="w-[100px] py-3 text-center text-xs font-semibold text-zinc-400">
              ステータス
            </th>
            <th className="py-3 pl-3 text-left text-xs font-semibold text-zinc-400">
              タイトル
            </th>
            <th className="w-[120px] py-3 text-center text-xs font-semibold text-zinc-400">
              種別
            </th>
            <th className="w-[120px] py-3 text-center text-xs font-semibold text-zinc-400">
              担当者
            </th>
            <th className="w-[100px] py-3 text-center">
              <button
                type="button"
                onClick={() => onToggleSort("createdAt")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-zinc-600"
              >
                作成日
                <SortIcon
                  column="createdAt"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </button>
            </th>
            <th className="w-16 py-3 text-center text-xs font-semibold text-zinc-400">
              3D
            </th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr
              key={issue.id}
              className="border-b border-zinc-200 hover:bg-zinc-50"
            >
              <td className="py-3 text-center">
                <StatusBadge status={issue.status} />
              </td>
              <td className="py-3 pl-3 text-[13px] text-zinc-900">
                {issue.title}
              </td>
              <td className="py-3 text-center text-[13px] text-zinc-500">
                {CATEGORY_LABELS[issue.category]}
              </td>
              <td className="py-3 text-center text-[13px] text-zinc-500">
                {issue.assigneeName ?? "未割当"}
              </td>
              <td className="py-3 text-center text-[13px] text-zinc-500">
                {formatDate(issue.createdAt)}
              </td>
              <td className="py-3 text-center">
                <Link
                  href={`/viewer?issueId=${issue.id}`}
                  className="inline-flex items-center gap-1 h-7 px-2 text-[11px] font-medium text-sky-600 border border-zinc-200 rounded-md hover:bg-zinc-50"
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
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  3D
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
