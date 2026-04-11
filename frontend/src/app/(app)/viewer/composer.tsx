"use client";

/**
 * Composer — IssuePanel の下部に固定される入力領域。
 *
 * @remarks
 * 添付写真プレビュー + コメント textarea + ActionBar（状態×ロールに応じたボタン）。
 * ボタン出し分けロジックは `composer.hooks.ts` の純粋関数に集約。
 *
 * 送信中は `isPending` で全ボタン disabled（二重クリック防止）。
 */

import { useCallback, useRef } from "react";
import {
  type ComposerAction,
  type ComposerMode,
  getComposerActionBarState,
} from "./composer.hooks";
import type { PendingAttachment, UploadingPhoto } from "./photo-upload.hooks";
import type { IssueStatus } from "./types";

type ComposerProps = {
  mode: ComposerMode;
  status: IssueStatus | null;
  company: "supervisor" | "contractor";
  body: string;
  onBodyChange: (value: string) => void;
  attachments: readonly PendingAttachment[];
  uploading: readonly UploadingPhoto[];
  onFilesSelected: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onAction: (action: ComposerAction) => void;
  isPending: boolean;
};

export function Composer({
  mode,
  status,
  company,
  body,
  onBodyChange,
  attachments,
  uploading,
  onFilesSelected,
  onRemoveAttachment,
  onAction,
  isPending,
}: ComposerProps) {
  const { hidden, canAttachPhoto, actions, waitingHint } =
    getComposerActionBarState({
      mode,
      status,
      company,
    });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) onFilesSelected(files);
      e.target.value = "";
    },
    [onFilesSelected],
  );

  const bodyEmpty = body.trim().length === 0;
  const isUploading = uploading.length > 0;

  if (hidden) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-200 bg-zinc-50">
        <svg
          className="h-4 w-4 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-[12px] text-zinc-600">
          この指摘は完了しています
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 border-t border-zinc-200">
      {waitingHint && (
        <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 border border-amber-200">
          <svg
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {waitingHint}
        </div>
      )}
      {(attachments.length > 0 || uploading.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="relative h-12 w-12 overflow-hidden rounded border border-zinc-200"
            >
              {/* biome-ignore lint/performance/noImgElement: object URL */}
              <img
                src={a.previewUrl}
                alt={a.fileName}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveAttachment(a.id)}
                className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-black/60 text-white text-[10px] hover:bg-black/80"
                aria-label={`${a.fileName} を削除`}
              >
                ×
              </button>
            </div>
          ))}
          {uploading.map((u) => (
            <div
              key={u.localId}
              className="relative h-12 w-12 overflow-hidden rounded border border-zinc-200 opacity-60"
            >
              {/* biome-ignore lint/performance/noImgElement: object URL */}
              <img
                src={u.previewUrl}
                alt={u.fileName}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-200">
                <div
                  className="h-full bg-zinc-900 transition-all"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder={getPlaceholder(mode, actions)}
        rows={3}
        maxLength={2000}
        className="w-full rounded-md border border-zinc-200 px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      />

      <div className="flex items-center gap-2">
        {canAttachPhoto && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={isPending}
              className="flex items-center gap-1 h-8 px-2.5 rounded-md border border-zinc-200 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              画像
            </button>
          </>
        )}
        <div className="flex-1" />
        {actions.map((action) => (
          <ActionButton
            key={action}
            action={action}
            disabled={isPending || bodyEmpty || isUploading}
            onClick={() => onAction(action)}
          />
        ))}
      </div>
    </div>
  );
}

function ActionButton({
  action,
  disabled,
  onClick,
}: {
  action: ComposerAction;
  disabled: boolean;
  onClick: () => void;
}) {
  const config = ACTION_CONFIG[action];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[12px] font-medium transition-colors ${
        config.primary
          ? "bg-zinc-900 text-white hover:bg-zinc-700"
          : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {config.label}
    </button>
  );
}

const ACTION_CONFIG: Record<
  ComposerAction,
  { label: string; primary: boolean }
> = {
  submit: { label: "作成", primary: true },
  comment: { label: "コメント", primary: false },
  start: { label: "作業開始", primary: true },
  correct: { label: "是正完了", primary: true },
  approve: { label: "承認", primary: true },
  reject: { label: "差し戻し", primary: false },
};

function getPlaceholder(
  mode: ComposerMode,
  actions: readonly ComposerAction[],
): string {
  if (mode === "add") return "初回コメント（作成時に必須）";
  if (actions.includes("start")) return "作業開始時のコメントを入力…";
  if (actions.includes("correct")) return "是正完了の報告を入力…";
  if (actions.includes("approve") || actions.includes("reject"))
    return "承認または差し戻しのコメントを入力…";
  return "質問・回答を入力…";
}
