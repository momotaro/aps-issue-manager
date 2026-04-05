"use client";

import { useCallback, useRef } from "react";
import { generateBase62Id } from "@/lib/generate-id";
import { ApsViewer } from "./aps-viewer";
import { useApsViewer } from "./aps-viewer.hooks";
import { useCameraNavigation } from "./camera-navigation.hooks";
import { useIssueFilters } from "./issue-filters.hooks";
import { IssueFormPanel } from "./issue-form";
import type { IssueFormValues } from "./issue-form.hooks";
import { IssueListPanel } from "./issue-list-panel";
import { IssuePinsOverlay, PinMarker } from "./issue-pins";
import { useIssuePins } from "./issue-pins.hooks";
import { useCreateIssue, useIssueList, useIssues } from "./issues-state.hooks";
import { useListPanel } from "./list-panel.hooks";
import { ListToggleBar } from "./list-toggle-bar";
import { PhotoComparison } from "./photo-comparison";
import { PhotoLightbox } from "./photo-lightbox";
import {
  useDeletePhoto,
  useIssueDetail,
  usePhotoUpload,
} from "./photo-upload.hooks";
import { usePhotoViewer } from "./photo-viewer.hooks";
import { usePlacementMode } from "./placement-mode.hooks";

// TODO: 認証実装後に動的に取得する
const TEMP_PROJECT_ID = "0000000000000000000001";
const TEMP_REPORTER_ID = "0000000000000000000001";

export default function ViewerPage() {
  const { containerRef, viewer, isLoading, error } = useApsViewer();
  const {
    data: issues = [],
    isLoading: issuesLoading,
    error: issuesError,
  } = useIssues(TEMP_PROJECT_ID);
  const createIssue = useCreateIssue();
  const { isPlacementMode, pendingPin, enterPlacementMode, clearPendingPin } =
    usePlacementMode(viewer);
  const { positions, selectedPin, handlePinClick, closePopup } = useIssuePins(
    viewer,
    issues,
  );

  // List panel state
  const {
    isOpen: isListOpen,
    open: openList,
    close: closeList,
  } = useListPanel();
  const { filters, setStatus, setCategory } = useIssueFilters();
  const { data: issueList = [], isLoading: issueListLoading } = useIssueList(
    TEMP_PROJECT_ID,
    filters,
  );

  // Photo viewer state
  const {
    lightbox,
    openLightbox,
    closeLightbox,
    navigateLightbox,
    comparison,
    openComparison,
    closeComparison,
  } = usePhotoViewer();

  // フォーム表示時に事前生成する issueId（レンダリング中に同期的に設定）
  const preIssueIdRef = useRef<string | null>(null);
  if (pendingPin && !preIssueIdRef.current) {
    preIssueIdRef.current = generateBase62Id();
  }
  if (!pendingPin) {
    preIssueIdRef.current = null;
  }
  const preIssueId = preIssueIdRef.current;

  // Issue detail for photo operations
  const activeIssueId = preIssueId ?? comparison.issueId;
  // preIssueId は作成成功後のみ detail を取得（未作成時は 404 になるため）
  const issueDetailId =
    (createIssue.isSuccess ? preIssueId : null) ?? comparison.issueId;
  const { data: issueDetail } = useIssueDetail(issueDetailId);
  const {
    uploading,
    pendingConfirms,
    addFiles,
    confirmPending,
    cleanup: cleanupUploads,
  } = usePhotoUpload(activeIssueId, TEMP_REPORTER_ID);
  const deletePhoto = useDeletePhoto(activeIssueId);

  const combinedLoading = isLoading || issuesLoading;
  const combinedError =
    error ||
    (issuesError instanceof Error
      ? issuesError.message
      : issuesError
        ? "指摘の取得に失敗しました"
        : null);

  const isFormOpen = pendingPin !== null;

  // Camera navigation
  const { navigateToIssue } = useCameraNavigation(viewer);

  const handleAddFromList = useCallback(() => {
    enterPlacementMode();
  }, [enterPlacementMode]);

  const handleFormSubmit = useCallback(
    (data: IssueFormValues) => {
      if (!pendingPin || !preIssueId) return;
      createIssue.mutate(
        {
          issueId: preIssueId,
          projectId: TEMP_PROJECT_ID,
          title: data.title,
          description: data.description,
          category: data.category,
          position: pendingPin.dbId
            ? {
                type: "component" as const,
                dbId: pendingPin.dbId,
                worldPosition: pendingPin.worldPosition,
              }
            : {
                type: "spatial" as const,
                worldPosition: pendingPin.worldPosition,
              },
          reporterId: TEMP_REPORTER_ID,
        },
        {
          onSuccess: () => {
            confirmPending();
            createIssue.reset();
            preIssueIdRef.current = null;
            clearPendingPin();
          },
        },
      );
    },
    [pendingPin, createIssue, preIssueId, confirmPending, clearPendingPin],
  );

  const handleFormCancel = useCallback(() => {
    preIssueIdRef.current = null;
    createIssue.reset();
    cleanupUploads();
    clearPendingPin();
  }, [createIssue, cleanupUploads, clearPendingPin]);

  const handleDeletePhoto = useCallback(
    (photoId: string) => {
      deletePhoto.mutate({ photoId, actorId: TEMP_REPORTER_ID });
    },
    [deletePhoto],
  );

  const photos = issueDetail?.photos ?? [];

  // IssueFormPanel の right 位置: リストパネル表示時は 320px、非表示時は 36px
  const formRightClass = isListOpen ? "right-80" : "right-9";

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between h-14 px-6 bg-[#0A0A0A] shrink-0">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 10h1l1-2h2l1 2h1m4 0h1l1-2h2l1 2h1M4 10v6a2 2 0 002 2h12a2 2 0 002-2v-6M6 6l2-4h8l2 4"
            />
          </svg>
          <span className="text-sm font-semibold text-white">
            指摘管理ツール
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-zinc-400">現場A棟</span>
          <svg
            className="h-5 w-5 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 relative">
          <ApsViewer
            containerRef={containerRef}
            isLoading={combinedLoading}
            error={combinedError}
          />
          {!combinedLoading && !combinedError && (
            <>
              <IssuePinsOverlay
                positions={positions}
                selectedPin={selectedPin}
                onPinClick={isPlacementMode ? () => {} : handlePinClick}
                onClose={closePopup}
                onComparePhotos={openComparison}
              />
              {pendingPin && (
                <div className="absolute inset-0 pointer-events-none z-20">
                  <div
                    className="absolute -translate-x-1/2 -translate-y-full"
                    style={{
                      left: pendingPin.screenPosition.x,
                      top: pendingPin.screenPosition.y,
                    }}
                  >
                    <PinMarker status="open" />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Photo Comparison overlay */}
          {comparison.isOpen && comparison.issueId && (
            <div className="absolute bottom-4 left-4 z-30 w-[600px]">
              <PhotoComparison
                photos={photos}
                onClose={closeComparison}
                onPhotoClick={openLightbox}
              />
            </div>
          )}
        </main>

        {isListOpen ? (
          <IssueListPanel
            issues={issueList}
            isLoading={issueListLoading}
            statusFilter={filters.status}
            categoryFilter={filters.category}
            onStatusChange={setStatus}
            onCategoryChange={setCategory}
            onAddClick={handleAddFromList}
            onClose={closeList}
            onCardClick={navigateToIssue}
          />
        ) : (
          <ListToggleBar onOpen={openList} />
        )}
      </div>

      <IssueFormPanel
        isOpen={isFormOpen}
        defaultTitle={pendingPin?.objectName}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
        isSubmitting={createIssue.isPending}
        isUploading={uploading.length > 0}
        photos={photos}
        uploading={uploading}
        pendingConfirms={pendingConfirms}
        onFilesSelected={addFiles}
        onDeletePhoto={handleDeletePhoto}
        onPhotoClick={openLightbox}
        isDeletePending={deletePhoto.isPending}
        rightClass={formRightClass}
      />

      {/* Lightbox */}
      {lightbox.isOpen && photos.length > 0 && (
        <PhotoLightbox
          photos={photos}
          currentIndex={Math.min(lightbox.currentIndex, photos.length - 1)}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      )}
    </div>
  );
}
