"use client";

/**
 * 指摘の履歴イベントを取得し、Timeline 表示用アイテム列に変換するフック。
 *
 * @remarks
 * `GET /api/issues/:id/history` の全イベントを取得し、
 * `CommentAdded` と `IssueStatusChanged` のみを `TimelineItem[]` に変換して返す。
 * `occurredAt` 昇順でソートし、コメントとステータス変更を時系列で混在表示できるようにする。
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { findMockUserById } from "@/lib/mock-users";
import {
  type IssueHistoryEvent,
  issueRepository,
} from "@/repositories/issue-repository";
import type { IssueStatus } from "./types";
import { STATUS_LABELS } from "./types";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type CommentTimelineItem = {
  type: "comment";
  commentId: string;
  body: string;
  actorId: string;
  attachments: readonly {
    id: string;
    fileName: string;
    storagePath: string;
    uploadedAt: string;
  }[];
  createdAt: string;
};

export type StatusChangeTimelineItem = {
  type: "statusChange";
  eventId: string;
  actorName: string;
  toLabel: string;
  toStatus: IssueStatus;
  occurredAt: string;
};

export type TimelineItem = CommentTimelineItem | StatusChangeTimelineItem;

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

export const ISSUE_HISTORY_KEY = (id: string) => ["issue-history", id] as const;

// ---------------------------------------------------------------------------
// 純粋変換関数（単体テスト可能）
// ---------------------------------------------------------------------------

/**
 * `IssueHistoryEvent[]` を `TimelineItem[]` に変換する純粋関数。
 *
 * - `CommentAdded` → `CommentTimelineItem`
 * - `IssueStatusChanged` → `StatusChangeTimelineItem`
 * - 他のイベントは無視する
 * - `occurredAt` 昇順でソート
 */
export function buildTimelineItems(
  events: readonly IssueHistoryEvent[],
): readonly TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const event of events) {
    if (event.type === "CommentAdded") {
      const { comment } = event.payload as {
        comment: {
          commentId: string;
          body: string;
          actorId: string;
          attachments: readonly {
            id: string;
            fileName: string;
            storagePath: string;
            uploadedAt: string;
          }[];
          createdAt: string;
        };
      };
      items.push({
        type: "comment",
        commentId: comment.commentId,
        body: comment.body,
        actorId: comment.actorId,
        attachments: comment.attachments,
        createdAt: comment.createdAt,
      });
    } else if (event.type === "IssueStatusChanged") {
      const payload = event.payload as { from: IssueStatus; to: IssueStatus };
      const toStatus = payload.to;
      const user = findMockUserById(event.actorId);
      items.push({
        type: "statusChange",
        eventId: event.id,
        actorName: user?.name ?? "不明なユーザー",
        toLabel: STATUS_LABELS[toStatus] ?? toStatus,
        toStatus,
        occurredAt: event.occurredAt,
      });
    }
    // IssueCreated / IssueTitleUpdated / IssueCategoryChanged / IssueAssigneeChanged は無視
  }

  // occurredAt 昇順でソート（安定ソート: 同一 occurredAt ではコメントを先に）
  items.sort((a, b) => {
    const aTime = new Date(
      a.type === "comment" ? a.createdAt : a.occurredAt,
    ).getTime();
    const bTime = new Date(
      b.type === "comment" ? b.createdAt : b.occurredAt,
    ).getTime();
    if (aTime !== bTime) return aTime - bTime;
    // 同一時刻: comment を statusChange より前に表示
    if (a.type === "comment" && b.type === "statusChange") return -1;
    if (a.type === "statusChange" && b.type === "comment") return 1;
    return 0;
  });

  return items;
}

// ---------------------------------------------------------------------------
// フック
// ---------------------------------------------------------------------------

export function useIssueTimeline(issueId: string | null): {
  items: readonly TimelineItem[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ISSUE_HISTORY_KEY(issueId ?? ""),
    queryFn: () => issueRepository.getIssueHistory(issueId ?? ""),
    enabled: !!issueId,
  });

  const items = useMemo(() => (data ? buildTimelineItems(data) : []), [data]);

  return { items, isLoading };
}
