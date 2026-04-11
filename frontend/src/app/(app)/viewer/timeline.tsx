"use client";

/**
 * Timeline — 指摘のやり取り（コメント一覧）を昇順チャット型で表示する。
 *
 * @remarks
 * #34 時点では `GET /api/issues/:id` の `recentComments`（最新 5 件）のみを扱う。
 * 古いコメントの遅延読み込みは follow-up Issue で実装する。
 *
 * 新規コメント追加後（`comments.length` 増加時）は自動で最下部にスクロールする。
 */

import { useEffect, useRef, useState } from "react";
import { findMockUserById } from "@/lib/mock-users";
import type { CommentItem } from "@/repositories/issue-repository";
import {
  type LightboxPhoto,
  PhotoLightbox,
  toLightboxPhotoFromStoragePath,
} from "./photo-lightbox";

type TimelineProps = {
  issueId: string;
  comments: readonly CommentItem[];
  isLoading: boolean;
};

export function Timeline({ comments, isLoading }: TimelineProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(comments.length);

  // 初期表示および新規追加時に最下部へスクロール
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNewComment = comments.length > prevCountRef.current;
    if (isNewComment || prevCountRef.current === 0) {
      el.scrollTop = el.scrollHeight;
    }
    prevCountRef.current = comments.length;
  }, [comments.length]);

  // lightbox 状態
  const [lightboxPhotos, setLightboxPhotos] = useState<
    readonly LightboxPhoto[] | null
  >(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (comment: CommentItem, attachmentIndex: number) => {
    const photos = comment.attachments.map((a) =>
      toLightboxPhotoFromStoragePath(a.id, a.fileName, a.storagePath),
    );
    setLightboxPhotos(photos);
    setLightboxIndex(attachmentIndex);
  };
  const closeLightbox = () => setLightboxPhotos(null);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between h-9 px-4 text-[12px]">
        <span className="font-medium text-zinc-600">やり取り</span>
        <span className="text-[11px] text-zinc-400">{comments.length}件</span>
      </div>
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-1 flex flex-col gap-4"
      >
        {isLoading && comments.length === 0 && (
          <p className="text-xs text-zinc-400 text-center py-4">
            読み込み中...
          </p>
        )}
        {!isLoading && comments.length === 0 && (
          <p className="text-xs text-zinc-400 text-center py-4">
            まだコメントがありません
          </p>
        )}
        {comments.map((c) => (
          <CommentItemView
            key={c.commentId}
            comment={c}
            onAttachmentClick={(idx) => openLightbox(c, idx)}
          />
        ))}
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

function CommentItemView({
  comment,
  onAttachmentClick,
}: {
  comment: CommentItem;
  onAttachmentClick: (attachmentIndex: number) => void;
}) {
  const user = findMockUserById(comment.actorId);
  const date = new Date(comment.createdAt);
  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

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
