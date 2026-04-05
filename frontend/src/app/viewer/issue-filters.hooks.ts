"use client";

import { useCallback, useState } from "react";
import type { IssueCategory, IssueStatus } from "./types";

export type IssueFilters = {
  status?: IssueStatus;
  category?: IssueCategory;
};

export function useIssueFilters() {
  const [filters, setFilters] = useState<IssueFilters>({});

  const setStatus = useCallback((status: IssueStatus | undefined) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const setCategory = useCallback((category: IssueCategory | undefined) => {
    setFilters((prev) => ({ ...prev, category }));
  }, []);

  return { filters, setStatus, setCategory };
}
