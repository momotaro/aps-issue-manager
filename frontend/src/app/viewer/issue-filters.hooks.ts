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
    setFilters((prev) => {
      if (status === undefined) {
        const { status: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, status };
    });
  }, []);

  const setCategory = useCallback((category: IssueCategory | undefined) => {
    setFilters((prev) => {
      if (category === undefined) {
        const { category: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, category };
    });
  }, []);

  return { filters, setStatus, setCategory };
}
