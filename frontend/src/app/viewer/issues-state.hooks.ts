"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateIssueInput,
  type IssueListItem,
  issueRepository,
} from "@/repositories/issue-repository";
import type { IssuePin, IssueStatus } from "./types";

const ISSUES_QUERY_KEY = ["issues"] as const;

function toIssuePin(item: IssueListItem): IssuePin {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    category: item.category,
    worldPosition: item.position.worldPosition,
  };
}

export function useIssues() {
  return useQuery({
    queryKey: ISSUES_QUERY_KEY,
    queryFn: () => issueRepository.getIssues(),
    select: (data) => data.map(toIssuePin),
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
