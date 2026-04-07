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

  // searchParams から派生した正規化済みの現在値
  const currentSearch = useMemo(
    () => ({
      keyword: searchParams.get("q") ?? "",
      status: parseStatus(searchParams.get("status")),
      category: parseCategory(searchParams.get("category")),
      assigneeId: searchParams.get("assigneeId") || undefined,
      sortBy: parseSortBy(searchParams.get("sortBy")),
      sortOrder: parseSortOrder(searchParams.get("sortOrder")),
    }),
    [searchParams],
  );

  const [keyword, setKeyword] = useState(currentSearch.keyword);
  const [debouncedKeyword, setDebouncedKeyword] = useState(
    currentSearch.keyword,
  );
  const [status, setStatus] = useState<IssueStatus | undefined>(
    currentSearch.status,
  );
  const [category, setCategory] = useState<IssueCategory | undefined>(
    currentSearch.category,
  );
  const [assigneeId, setAssigneeId] = useState<string | undefined>(
    currentSearch.assigneeId,
  );
  const [sortBy, setSortBy] = useState<SortBy>(currentSearch.sortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    currentSearch.sortOrder,
  );

  // ブラウザの戻る/進む等で searchParams が変化した時に state を再同期
  // debouncedKeyword も即時リセットして 300ms ラグを回避する
  useEffect(() => {
    setKeyword(currentSearch.keyword);
    setDebouncedKeyword(currentSearch.keyword);
    setStatus(currentSearch.status);
    setCategory(currentSearch.category);
    setAssigneeId(currentSearch.assigneeId);
    setSortBy(currentSearch.sortBy);
    setSortOrder(currentSearch.sortOrder);
  }, [currentSearch]);

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
