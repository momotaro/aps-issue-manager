"use client";

/**
 * Timeline に表示するコメント一覧を取得・整形するフック。
 *
 * @remarks
 * backend `GET /api/issues/:id` レスポンスの `recentComments`（最新 5 件、降順）を
 * Timeline 表示用に昇順に並べ替えて返す。
 *
 * #34 時点では最新 5 件のみを扱い、古いコメントの遅延読み込みは別 Issue で実装する
 * （`docs/guides/future-considerations.md` 参照）。
 */

import { useMemo } from "react";
import type { CommentItem } from "@/repositories/issue-repository";
import { useIssueDetail } from "./issue-detail.hooks";

export function useIssueCommentsTimeline(issueId: string | null): {
  comments: readonly CommentItem[];
  isLoading: boolean;
  error: unknown;
} {
  const { data, isLoading, error } = useIssueDetail(issueId);

  const comments = useMemo<readonly CommentItem[]>(() => {
    if (!data) return [];
    // backend は降順（新しい順）で返すため、Timeline 表示用に昇順（古い順）に並べ替え
    return [...data.recentComments].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [data]);

  return { comments, isLoading, error };
}
