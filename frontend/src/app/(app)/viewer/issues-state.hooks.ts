"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateIssueInput,
  type IssueListItem,
  issueRepository,
} from "@/repositories/issue-repository";
import type { IssueCategory, IssuePin, IssueStatus } from "./types";

type UpdateIssueInput = {
  id: string;
  actorId: string;
  prev: {
    title: string;
    description: string;
    category: IssueCategory;
    status: IssueStatus;
  };
  next: {
    title: string;
    description: string;
    category: IssueCategory;
    status?: IssueStatus;
  };
};

const ISSUES_QUERY_KEY = ["issues"] as const;

function toIssuePin(item: IssueListItem): IssuePin {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    category: item.category,
    worldPosition: item.position.worldPosition,
    photoCount: item.photoCount,
  };
}

export function useIssues(projectId: string) {
  return useQuery({
    queryKey: [...ISSUES_QUERY_KEY, projectId],
    queryFn: () => issueRepository.getIssues({ projectId }),
    select: (data) => data.map(toIssuePin),
  });
}

export function useIssueList(
  projectId: string,
  filters?: { status?: IssueStatus; category?: IssueCategory },
) {
  return useQuery({
    queryKey: [...ISSUES_QUERY_KEY, projectId, filters],
    queryFn: () => issueRepository.getIssues({ projectId, ...filters }),
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateIssueInput) => issueRepository.createIssue(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
    },
  });
}

export function useChangeIssueStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
      actorId,
    }: {
      id: string;
      status: IssueStatus;
      actorId: string;
    }) => issueRepository.changeIssueStatus(id, status, actorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
    },
  });
}

export function useUpdateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, actorId, prev, next }: UpdateIssueInput) => {
      const promises: Promise<{ ok: true }>[] = [];
      if (next.title !== prev.title) {
        promises.push(issueRepository.updateTitle(id, next.title, actorId));
      }
      if (next.description !== prev.description) {
        promises.push(
          issueRepository.updateDescription(id, next.description, actorId),
        );
      }
      if (next.category !== prev.category) {
        promises.push(
          issueRepository.updateCategory(id, next.category, actorId),
        );
      }
      if (next.status && next.status !== prev.status) {
        promises.push(
          issueRepository.changeIssueStatus(id, next.status, actorId),
        );
      }
      await Promise.all(promises);
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["issue-detail", id] });
    },
  });
}
