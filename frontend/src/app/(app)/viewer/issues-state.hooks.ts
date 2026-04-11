"use client";

/**
 * Issue 集約の TanStack Query state フック群。
 *
 * @remarks
 * ユースケース指向 API（`PUT /:id`, `POST /:id/correct`, `POST /:id/review`, `POST /:id/comments`）に対応する。
 * 旧フック（`useChangeIssueStatus` / 個別フィールド更新）は削除済み。
 *
 * invalidate 戦略: すべてのコマンド成功時に `['issues']` プレフィックスを一括 invalidate する
 * （`['issues', projectId, filters]` 構造と `['issue-detail', id]` を同時に更新）。
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateIssueInput,
  type IssueListItem,
  issueRepository,
} from "@/repositories/issue-repository";
import { ISSUE_DETAIL_KEY } from "./issue-detail.hooks";
import type { IssueCategory, IssuePin, IssueStatus } from "./types";

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

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateIssueInput) => issueRepository.createIssue(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
    },
  });
}

/** 基本情報一括更新（title / category / assigneeId）。単一 API コール。 */
export function useUpdateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
      actorId,
    }: {
      id: string;
      input: {
        title?: string;
        category?: IssueCategory;
        assigneeId?: string | null;
      };
      actorId: string;
    }) => issueRepository.updateIssue(id, input, actorId),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ISSUE_DETAIL_KEY(id) });
    },
  });
}

/** 是正完了操作（ステータス遷移 + コメント + 写真添付）。 */
export function useCorrectIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
      actorId,
    }: {
      id: string;
      input: {
        status?: IssueStatus;
        comment: {
          commentId: string;
          body: string;
          attachments?: {
            id: string;
            fileName: string;
            storagePath: string;
            uploadedAt: string;
          }[];
        };
      };
      actorId: string;
    }) => issueRepository.correctIssue(id, input, actorId),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ISSUE_DETAIL_KEY(id) });
    },
  });
}

/** レビュー操作（承認 / 差し戻し）。コメント必須、写真添付不可。 */
export function useReviewIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
      actorId,
    }: {
      id: string;
      input: {
        status?: IssueStatus;
        comment: {
          commentId: string;
          body: string;
        };
      };
      actorId: string;
    }) => issueRepository.reviewIssue(id, input, actorId),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ISSUE_DETAIL_KEY(id) });
    },
  });
}

/** コメントのみ追加（ステータス変化なし）。写真添付可。 */
export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
      actorId,
    }: {
      id: string;
      input: {
        comment: {
          commentId: string;
          body: string;
          attachments?: {
            id: string;
            fileName: string;
            storagePath: string;
            uploadedAt: string;
          }[];
        };
      };
      actorId: string;
    }) => issueRepository.addComment(id, input, actorId),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ISSUE_DETAIL_KEY(id) });
    },
  });
}
