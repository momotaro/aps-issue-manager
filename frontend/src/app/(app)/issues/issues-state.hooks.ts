import { useQuery } from "@tanstack/react-query";
import { TEMP_PROJECT_ID } from "@/lib/constants";
import { issueRepository } from "@/repositories/issue-repository";
import type { IssueCategory, IssueStatus } from "@/types/issue";

export function useIssueListPage(queryFilters: {
  q?: string;
  status?: IssueStatus;
  category?: IssueCategory;
  assigneeId?: string;
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: ["issues", TEMP_PROJECT_ID, queryFilters],
    queryFn: () =>
      issueRepository.getIssues({
        projectId: TEMP_PROJECT_ID,
        ...queryFilters,
      }),
  });
}
