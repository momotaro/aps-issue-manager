"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORY_LABELS,
  type IssueCategory,
  type IssueStatus,
  STATUS_LABELS,
} from "@/types/issue";

export type SortBy = "createdAt" | "updatedAt";
export type SortOrder = "asc" | "desc";

const VALID_STATUSES = new Set(Object.keys(STATUS_LABELS));
const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS));
const VALID_SORT_BY = new Set<string>(["createdAt", "updatedAt"]);
const VALID_SORT_ORDER = new Set<string>(["asc", "desc"]);

function parseStatus(value: string | null): IssueStatus | undefined {
  return value && VALID_STATUSES.has(value)
    ? (value as IssueStatus)
    : undefined;
}

function parseCategory(value: string | null): IssueCategory | undefined {
  return value && VALID_CATEGORIES.has(value)
    ? (value as IssueCategory)
    : undefined;
}

function parseSortBy(value: string | null): SortBy {
  return value && VALID_SORT_BY.has(value) ? (value as SortBy) : "createdAt";
}

function parseSortOrder(value: string | null): SortOrder {
  return value && VALID_SORT_ORDER.has(value) ? (value as SortOrder) : "desc";
}

export function useIssueSearch() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);
  const [status, setStatus] = useState<IssueStatus | undefined>(
    parseStatus(searchParams.get("status")),
  );
  const [category, setCategory] = useState<IssueCategory | undefined>(
    parseCategory(searchParams.get("category")),
  );
  const [assigneeId, setAssigneeId] = useState<string | undefined>(
    searchParams.get("assigneeId") || undefined,
  );
  const [sortBy, setSortBy] = useState<SortBy>(
    parseSortBy(searchParams.get("sortBy")),
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    parseSortOrder(searchParams.get("sortOrder")),
  );

  // デバウンス
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  // URL 同期
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (debouncedKeyword) params.set("q", debouncedKeyword);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (assigneeId) params.set("assigneeId", assigneeId);
    if (sortBy !== "createdAt") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/issues", { scroll: false });
  }, [
    debouncedKeyword,
    status,
    category,
    assigneeId,
    sortBy,
    sortOrder,
    router,
  ]);

  const toggleSort = useCallback(
    (column: SortBy) => {
      if (sortBy === column) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(column);
        setSortOrder("desc");
      }
    },
    [sortBy],
  );

  const queryFilters = useMemo(
    () => ({
      ...(debouncedKeyword && { q: debouncedKeyword }),
      ...(status && { status }),
      ...(category && { category }),
      ...(assigneeId && { assigneeId }),
      sortBy,
      sortOrder,
    }),
    [debouncedKeyword, status, category, assigneeId, sortBy, sortOrder],
  );

  return {
    keyword,
    setKeyword,
    debouncedKeyword,
    status,
    setStatus,
    category,
    setCategory,
    assigneeId,
    setAssigneeId,
    sortBy,
    sortOrder,
    toggleSort,
    queryFilters,
  };
}
