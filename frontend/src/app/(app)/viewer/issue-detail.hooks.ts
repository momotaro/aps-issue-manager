"use client";

/**
 * Issue 詳細を取得するフック（`GET /api/issues/:id`）。
 *
 * @remarks
 * レスポンスの `recentComments` には最新 5 件のコメントが含まれる（backend の read モデル）。
 * Timeline での表示はこの `recentComments` を `useIssueCommentsTimeline` 経由で整形する。
 */

import { useQuery } from "@tanstack/react-query";
import { issueRepository } from "@/repositories/issue-repository";

export const ISSUE_DETAIL_KEY = (id: string) => ["issue-detail", id] as const;

export function useIssueDetail(issueId: string | null) {
  return useQuery({
    queryKey: ISSUE_DETAIL_KEY(issueId ?? ""),
    queryFn: () => issueRepository.getIssueDetail(issueId ?? ""),
    enabled: !!issueId,
  });
}
