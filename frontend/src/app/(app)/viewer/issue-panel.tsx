"use client";

/**
 * IssuePanel — viewer ページの中央パネル。
 *
 * @remarks
 * レイアウト（上から）:
 * - PanelHeader（タイトル + StatusBadge + 閉じるボタン）
 * - IssueForm（title / category / assigneeId）
 * - TimelineSection（Edit モード時のみ、最新 5 件のコメント）
 * - Composer（下部固定）
 *
 * モード:
 * - `add` — 新規作成（PendingPin 位置に紐づく）
 * - `edit` — 既存 Issue の編集・操作
 *
 * パネル自体は「ピン選択中」または「追加モード」のときのみ描画される
 * （viewer-client.tsx 側で制御）。未選択時は何もレンダリングしない。
 *
 * ActionBar のボタン出し分けは `composer.hooks.ts` の `getComposerActionBarState` に委譲。
 */

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/components/current-user-provider";
import { generateBase62Id } from "@/lib/generate-id";
import type { UserCompany } from "@/lib/mock-users";
import { Composer } from "./composer";
import type { ComposerAction } from "./composer.hooks";
import { useIssueDetail } from "./issue-detail.hooks";
import { IssueForm } from "./issue-form";
import { useAddIssueForm, useEditIssueForm } from "./issue-form.hooks";
import { useIssueTimeline } from "./issue-history.hooks";
import {
  useAddComment,
  useCorrectIssue,
  useCreateIssue,
  useReviewIssue,
  useUpdateIssue,
} from "./issues-state.hooks";
import type { PendingAttachment } from "./photo-upload.hooks";
import { usePhotoUpload } from "./photo-upload.hooks";
import { Timeline } from "./timeline";
import {
  type IssueCategory,
  type IssueStatus,
  STATUS_COLORS,
  STATUS_LABELS,
} from "./types";

export type PendingPinPayload = {
  worldPosition: { x: number; y: number; z: number };
  dbId?: number;
  objectName?: string;
};

type IssuePanelProps = {
  /** Edit モードの対象 Issue ID（`null` のときは Add モードか閉じた状態）。 */
  selectedIssueId: string | null;
  /** Add モード用: 新規 Pin の 3D 位置情報（存在すれば Add モードになる）。 */
  pendingPin: PendingPinPayload | null;
  /** Add モード用の事前生成 issueId（reporter 側で Pin 生成時に決める）。 */
  pendingIssueId: string | null;
  /** Add モード用の初期 Project ID。 */
  projectId: string;
  /** 閉じる（Add キャンセル or Edit パネル閉じる）。 */
  onClose: () => void;
  /** Add 成功後のコールバック（pendingPin クリアなど）。 */
  onAddSuccess: () => void;
};

export function IssuePanel(props: IssuePanelProps) {
  const {
    selectedIssueId,
    pendingPin,
    pendingIssueId,
    projectId,
    onClose,
    onAddSuccess,
  } = props;

  if (pendingPin && pendingIssueId) {
    return (
      <AddModePanel
        pendingPin={pendingPin}
        pendingIssueId={pendingIssueId}
        projectId={projectId}
        onClose={onClose}
        onAddSuccess={onAddSuccess}
      />
    );
  }

  if (selectedIssueId) {
    return <EditModePanel issueId={selectedIssueId} onClose={onClose} />;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Add mode
// ---------------------------------------------------------------------------

function AddModePanel({
  pendingPin,
  pendingIssueId,
  projectId,
  onClose,
  onAddSuccess,
}: {
  pendingPin: PendingPinPayload;
  pendingIssueId: string;
  projectId: string;
  onClose: () => void;
  onAddSuccess: () => void;
}) {
  const { currentUser } = useCurrentUser();

  // draft コメント ID は pendingIssueId に紐づけて安定化する
  const commentIdRef = useRef<string>("");
  if (!commentIdRef.current) {
    commentIdRef.current = generateBase62Id();
  }

  const form = useAddIssueForm(true, {
    title: pendingPin.objectName,
  });
  const createIssue = useCreateIssue();

  const photoUpload = usePhotoUpload(pendingIssueId, commentIdRef.current);
  const cleanupRef = useRef(photoUpload.cleanup);
  cleanupRef.current = photoUpload.cleanup;

  useEffect(() => {
    const cleanup = cleanupRef.current;
    return () => cleanup();
  }, []);

  const body = form.watch("initialComment");

  const handleSubmit = (action: ComposerAction) => {
    if (action !== "submit") return;
    form.handleSubmit((values) => {
      const position = pendingPin.dbId
        ? {
            type: "component" as const,
            dbId: pendingPin.dbId,
            worldPosition: pendingPin.worldPosition,
          }
        : {
            type: "spatial" as const,
            worldPosition: pendingPin.worldPosition,
          };
      createIssue.mutate(
        {
          issueId: pendingIssueId,
          projectId,
          title: values.title,
          category: values.category,
          position,
          reporterId: currentUser.id,
          assigneeId: values.assigneeId ?? null,
          comment: {
            commentId: commentIdRef.current,
            body: values.initialComment,
            attachments: photoUpload.attachments.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              storagePath: a.storagePath,
              uploadedAt: a.uploadedAt,
            })),
          },
        },
        {
          onSuccess: () => {
            photoUpload.clear();
            onAddSuccess();
          },
        },
      );
    })();
  };

  return (
    <aside className="w-[400px] shrink-0 border-l border-zinc-200 bg-white flex flex-col h-full">
      <PanelHeader title="指摘を追加" statusLabel="新規" onClose={onClose} />
      <IssueForm
        register={form.register as never}
        errors={form.formState.errors as never}
        mode="add"
      />
      <div className="flex-1" />
      <Composer
        mode="add"
        status={null}
        company={currentUser.company}
        body={body}
        onBodyChange={(v) => form.setValue("initialComment", v)}
        attachments={photoUpload.attachments}
        uploading={photoUpload.uploading}
        onFilesSelected={photoUpload.addFiles}
        onRemoveAttachment={photoUpload.removeAttachment}
        onAction={handleSubmit}
        isPending={createIssue.isPending}
      />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Edit mode
// ---------------------------------------------------------------------------

function EditModePanel({
  issueId,
  onClose,
}: {
  issueId: string;
  onClose: () => void;
}) {
  const { currentUser } = useCurrentUser();
  const { data: detail, isLoading: detailLoading } = useIssueDetail(issueId);
  const { items, isLoading: historyLoading } = useIssueTimeline(issueId);

  // 閲覧/編集モード切替
  const [isEditing, setIsEditing] = useState(false);

  // issueId が変わったら閲覧モードに戻す
  // biome-ignore lint/correctness/useExhaustiveDependencies: issueId をトリガーに isEditing をリセットする意図
  useEffect(() => {
    setIsEditing(false);
  }, [issueId]);

  // draft コメント ID（送信ごとに再生成）
  const [commentIdForDraft, setCommentIdForDraft] = useDraftCommentId();

  // メタ情報編集フォーム
  const form = useEditIssueForm(
    true,
    detail
      ? {
          title: detail.title,
          category: detail.category as IssueCategory,
          assigneeId: detail.assigneeId,
        }
      : undefined,
    issueId,
  );
  const updateIssue = useUpdateIssue();
  const correctIssue = useCorrectIssue();
  const reviewIssue = useReviewIssue();
  const addComment = useAddComment();

  const photoUpload = usePhotoUpload(issueId, commentIdForDraft);
  const editCleanupRef = useRef(photoUpload.cleanup);
  editCleanupRef.current = photoUpload.cleanup;

  // biome-ignore lint/correctness/useExhaustiveDependencies: issueId をトリガーに cleanup を実行する意図
  useEffect(() => {
    const cleanup = editCleanupRef.current;
    return () => cleanup();
  }, [issueId]);

  // Composer の draft 本文は独立 state（form に乗せない）
  const [draftBody, setDraftBody] = useDraftBody(issueId);

  // detail が未ロードの間は Composer を操作不能にする（送信後のフィールドが
  // 揃っていないためだが、ユーザーには明示的にボタンが disabled に見える必要がある）
  const isPending =
    detailLoading ||
    updateIssue.isPending ||
    correctIssue.isPending ||
    reviewIssue.isPending ||
    addComment.isPending;

  const handleSaveMeta = () => {
    form.handleSubmit((values) => {
      updateIssue.mutate(
        {
          id: issueId,
          input: {
            title: values.title,
            category: values.category,
            assigneeId: values.assigneeId ?? null,
          },
          actorId: currentUser.id,
        },
        { onSuccess: () => setIsEditing(false) },
      );
    })();
  };

  const handleCancel = () => {
    form.reset(
      detail
        ? {
            title: detail.title,
            category: detail.category as IssueCategory,
            assigneeId: detail.assigneeId,
          }
        : undefined,
    );
    setIsEditing(false);
  };

  const handleComposerAction = (action: ComposerAction) => {
    // Composer は detailLoading 中は isPending で disabled のため、
    // 基本的にここには到達しないが、防御的に issueId/actorId のみで
    // mutation を組み立てる（detail には依存しない）。
    const common = {
      id: issueId,
      actorId: currentUser.id,
    };
    const comment = {
      commentId: commentIdForDraft,
      body: draftBody,
    };
    const attachments: PendingAttachment[] = photoUpload.attachments.map(
      (a) => ({
        id: a.id,
        fileName: a.fileName,
        storagePath: a.storagePath,
        uploadedAt: a.uploadedAt,
        previewUrl: a.previewUrl,
      }),
    );
    const commentWithAttachments = {
      ...comment,
      attachments: attachments.map(
        ({ previewUrl: _previewUrl, ...rest }) => rest,
      ),
    };

    const onSuccess = () => {
      photoUpload.clear();
      setDraftBody("");
      setCommentIdForDraft(generateBase62Id());
    };

    switch (action) {
      case "comment":
        addComment.mutate(
          {
            ...common,
            input: { comment: commentWithAttachments },
          },
          { onSuccess },
        );
        break;
      case "start":
        // 協力会社が open 状態から作業開始を宣言する（open → in_progress）。
        // correctIssueUseCase が任意の status 遷移 + コメントをアトミックに処理する。
        correctIssue.mutate(
          {
            ...common,
            input: {
              status: "in_progress",
              comment: commentWithAttachments,
            },
          },
          { onSuccess },
        );
        break;
      case "correct":
        correctIssue.mutate(
          {
            ...common,
            input: {
              status: "in_review",
              comment: commentWithAttachments,
            },
          },
          { onSuccess },
        );
        break;
      case "approve":
        reviewIssue.mutate(
          {
            ...common,
            input: {
              status: "done",
              comment: { commentId: comment.commentId, body: comment.body },
            },
          },
          { onSuccess },
        );
        break;
      case "reject":
        reviewIssue.mutate(
          {
            ...common,
            input: {
              status: "in_progress",
              comment: { commentId: comment.commentId, body: comment.body },
            },
          },
          { onSuccess },
        );
        break;
      default:
        break;
    }
  };

  const status = (detail?.status as IssueStatus | undefined) ?? null;
  const statusLabel = status ? STATUS_LABELS[status] : "";

  return (
    <aside className="w-[400px] shrink-0 border-l border-zinc-200 bg-white flex flex-col h-full">
      <PanelHeader
        title="指摘詳細"
        statusLabel={statusLabel}
        status={status}
        onClose={onClose}
        actions={
          isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="text-[11px] text-zinc-500 hover:text-zinc-700"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveMeta}
                className="text-[11px] text-zinc-600 hover:text-zinc-900"
              >
                保存
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={detailLoading}
              className="text-[11px] text-zinc-600 hover:text-zinc-900 disabled:opacity-40"
            >
              編集
            </button>
          )
        }
      />
      <IssueForm
        register={form.register as never}
        errors={form.formState.errors as never}
        mode="edit"
        readOnly={!isEditing}
      />
      <Timeline issueId={issueId} items={items} isLoading={historyLoading} />
      <Composer
        mode="edit"
        status={status}
        company={currentUser.company as UserCompany}
        body={draftBody}
        onBodyChange={setDraftBody}
        attachments={photoUpload.attachments}
        uploading={photoUpload.uploading}
        onFilesSelected={photoUpload.addFiles}
        onRemoveAttachment={photoUpload.removeAttachment}
        onAction={handleComposerAction}
        isPending={isPending}
      />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Panel header
// ---------------------------------------------------------------------------

function PanelHeader({
  title,
  statusLabel,
  status,
  onClose,
  actions,
}: {
  title: string;
  statusLabel: string;
  status?: IssueStatus | null;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const colors = status ? STATUS_COLORS[status] : null;
  return (
    <div className="flex items-center justify-between h-12 px-4 border-b border-zinc-200 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-zinc-900">{title}</span>
        {statusLabel && (
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
              colors
                ? `${colors.bg} ${colors.text} border-transparent`
                : "border border-zinc-200 bg-zinc-50 text-zinc-600"
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="text-zinc-400 hover:text-zinc-600"
        >
          <svg
            className="h-[18px] w-[18px]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local state helpers
// ---------------------------------------------------------------------------

function useDraftCommentId(): [string, (id: string) => void] {
  const [id, setId] = useState<string>(() => generateBase62Id());
  return [id, setId];
}

function useDraftBody(key: string): [string, (v: string) => void] {
  const [body, setBody] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: key 変化を reset トリガーとして意図的に使用
  useEffect(() => {
    setBody("");
  }, [key]);
  return [body, setBody];
}
