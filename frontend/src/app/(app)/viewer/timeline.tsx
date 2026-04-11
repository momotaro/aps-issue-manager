"use client";

/**
 * Timeline — 指摘のコメント・履歴を昇順チャット型で表示する。
 *
 * @remarks
 * `useIssueTimeline` が返す `TimelineItem[]` を受け取り、
 * `comment` はチャット形式、`statusChange` は pill 形式で表示する。
 *
 * 新規アイテム追加後（`items.length` 増加時）は自動で最下部にスクロールする。
 */

import { useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/lib/format-date-time";
import { findMockUserById } from "@/lib/mock-users";
import type {
  CommentTimelineItem,
  StatusChangeTimelineItem,
  TimelineItem,
} from "./issue-history.hooks";
import {
  type LightboxPhoto,
  PhotoLightbox,
  toLightboxPhotoFromStoragePath,
} from "./photo-lightbox";

type TimelineProps = {
  issueId: string;
  items: readonly TimelineItem[];
  isLoading: boolean;
};

export function Timeline({ items, isLoading }: TimelineProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(items.length);

  // 初期表示および新規追加時に最下部へスクロール
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNewItem = items.length > prevCountRef.current;
    if (isNewItem || prevCountRef.current === 0) {
      el.scrollTop = el.scrollHeight;
    }
    prevCountRef.current = items.length;
  }, [items.length]);

  // lightbox 状態
  const [lightboxPhotos, setLightboxPhotos] = useState<
    readonly LightboxPhoto[] | null
  >(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (
    comment: CommentTimelineItem,
    attachmentIndex: number,
  ) => {
    const user = findMockUserById(comment.actorId);
    const commentContext = {
      actorName: user?.name ?? "不明なユーザー",
      actorColor: user?.color ?? "#9CA3AF",
      createdAt: comment.createdAt,
      commentBody: comment.body,
    };
    const photos = comment.attachments.map((a) =>
      toLightboxPhotoFromStoragePath(
        a.id,
        a.fileName,
        a.storagePath,
        commentContext,
      ),
    );
    setLightboxPhotos(photos);
    setLightboxIndex(attachmentIndex);
  };
  const closeLightbox = () => setLightboxPhotos(null);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between h-9 px-4 text-[12px]">
        <span className="font-medium text-zinc-600">コメント・履歴</span>
        <span className="text-[11px] text-zinc-400">{items.length}件</span>
      </div>
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-1 flex flex-col gap-4"
      >
        {isLoading && items.length === 0 && (
          <p className="text-xs text-zinc-400 text-center py-4">
            読み込み中...
          </p>
        )}
        {!isLoading && items.length === 0 && (
          <p className="text-xs text-zinc-400 text-center py-4">
            まだコメントがありません
          </p>
        )}
        {items.map((item) =>
          item.type === "comment" ? (
            <CommentItemView
              key={item.commentId}
              comment={item}
              onAttachmentClick={(idx) => openLightbox(item, idx)}
            />
          ) : (
            <StatusChangeItemView key={item.eventId} item={item} />
          ),
        )}
      </div>

      {lightboxPhotos && (
        <PhotoLightbox
          photos={lightboxPhotos}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// コメント行
// ---------------------------------------------------------------------------

function CommentItemView({
  comment,
  onAttachmentClick,
}: {
  comment: CommentTimelineItem;
  onAttachmentClick: (attachmentIndex: number) => void;
}) {
  const user = findMockUserById(comment.actorId);
  const timeStr = formatDateTime(comment.createdAt);

  return (
    <div className="flex gap-2">
      <div
        className="h-7 w-7 shrink-0 rounded-full"
        style={{ backgroundColor: user?.color ?? "#9CA3AF" }}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold text-zinc-900">
            {user?.name ?? "不明なユーザー"}
          </span>
          <span className="text-[10px] text-zinc-400">{timeStr}</span>
        </div>
        <div className="flex flex-col gap-2 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2.5">
          <p className="text-[12px] text-zinc-800 whitespace-pre-wrap break-words">
            {comment.body}
          </p>
          {comment.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {comment.attachments.map((a, idx) => {
                const src = toLightboxPhotoFromStoragePath(
                  a.id,
                  a.fileName,
                  a.storagePath,
                ).src;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onAttachmentClick(idx)}
                    className="overflow-hidden rounded border border-zinc-200"
                    aria-label={`添付画像: ${a.fileName}`}
                  >
                    {/* biome-ignore lint/performance/noImgElement: external MinIO URL */}
                    <img
                      src={src}
                      alt={a.fileName}
                      className="h-16 w-16 object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ステータス変更行（pill スタイル）
// ---------------------------------------------------------------------------

function StatusChangeItemView({ item }: { item: StatusChangeTimelineItem }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
      <div className="h-px flex-1 bg-zinc-200" />
      <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1">
        <StatusChangeIcon toStatus={item.toStatus} />
        <span>
          {item.actorName}が {item.toLabel} に変更しました
        </span>
      </div>
      <div className="h-px flex-1 bg-zinc-200" />
    </div>
  );
}

function StatusChangeIcon({ toStatus }: { toStatus: string }) {
  if (toStatus === "done") {
    return (
      <svg
        className="h-3 w-3 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  }
  if (toStatus === "in_progress" || toStatus === "in_review") {
    return (
      <svg
        className="h-3 w-3 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
        />
      </svg>
    );
  }
  // open（差し戻し等）: 戻る矢印
  return (
    <svg
      className="h-3 w-3 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
      />
    </svg>
  );
}
