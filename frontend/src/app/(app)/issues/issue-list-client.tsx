"use client";

import { IssueFilterBar } from "./issue-filter-bar";
import { useIssueSearch } from "./issue-search.hooks";
import { IssueSearchBar } from "./issue-search-bar";
import { IssueTable } from "./issue-table";
import { useIssueListPage } from "./issues-state.hooks";

export function IssueListClient() {
  const {
    keyword,
    setKeyword,
    status,
    setStatus,
    category,
    setCategory,
    sortBy,
    sortOrder,
    toggleSort,
    queryFilters,
  } = useIssueSearch();

  const { data: issues = [], isLoading } = useIssueListPage(queryFilters);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-4 h-14 px-6 border-b border-zinc-200 shrink-0">
        <IssueSearchBar value={keyword} onChange={setKeyword} />
        <IssueFilterBar
          status={status}
          category={category}
          onStatusChange={setStatus}
          onCategoryChange={setCategory}
        />
      </div>
      <div className="flex flex-col flex-1 px-6 overflow-hidden">
        <IssueTable
          issues={issues}
          isLoading={isLoading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onToggleSort={toggleSort}
        />
      </div>
    </div>
  );
}
