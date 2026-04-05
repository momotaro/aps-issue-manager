"use client";

import { useCallback, useState } from "react";
import { ApsViewer } from "./aps-viewer";
import { useApsViewer } from "./aps-viewer.hooks";
import { IssueFormPanel } from "./issue-form";
import type { IssueFormValues } from "./issue-form.hooks";
import { IssuePinsOverlay, PinMarker } from "./issue-pins";
import { useIssuePins } from "./issue-pins.hooks";
import { useCreateIssue, useIssues } from "./issues-state.hooks";
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
  const {
    isPlacementMode,
    pendingPin,
    enterPlacementMode,
    exitPlacementMode,
    clearPendingPin,
  } = usePlacementMode(viewer);
  const { positions, selectedPin, handlePinClick, closePopup } = useIssuePins(
    viewer,
    issues,
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

  // Track created issue ID for photo uploads after creation
  const [createdIssueId, setCreatedIssueId] = useState<string | null>(null);

  // Issue detail for photo operations — form takes priority over comparison
  const formIssueId = createdIssueId;
  const comparisonIssueId = comparison.issueId;
  const activeIssueId = formIssueId ?? comparisonIssueId;
  const { data: issueDetail } = useIssueDetail(activeIssueId);
  const {
    uploading,
    staged,
    addFiles,
    removeStaged,
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

  const handleFormSubmit = useCallback(
    (data: IssueFormValues) => {
      if (!pendingPin || createdIssueId) return;
      createIssue.mutate(
        {
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
          onSuccess: (result) => {
            setCreatedIssueId(result.issueId);
          },
        },
      );
    },
    [pendingPin, createIssue, createdIssueId],
  );

  const handleFormCancel = useCallback(() => {
    setCreatedIssueId(null);
    cleanupUploads();
    clearPendingPin();
  }, [cleanupUploads, clearPendingPin]);

  const handleDeletePhoto = useCallback(
    (photoId: string) => {
      deletePhoto.mutate({ photoId, actorId: TEMP_REPORTER_ID });
    },
    [deletePhoto],
  );

  const photos = issueDetail?.photos ?? [];

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center h-14 px-4 border-b border-zinc-200 bg-white shrink-0">
        <h1 className="text-lg font-semibold text-zinc-900">3D Model Viewer</h1>
        <button
          type="button"
          onClick={isPlacementMode ? exitPlacementMode : enterPlacementMode}
          className={`ml-auto px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isPlacementMode
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          ＋ 指摘を追加
        </button>
      </header>
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

      <IssueFormPanel
        isOpen={isFormOpen}
        defaultTitle={pendingPin?.objectName}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
        isSubmitting={createIssue.isPending}
        photos={photos}
        uploading={uploading}
        staged={staged}
        onFilesSelected={addFiles}
        onDeletePhoto={handleDeletePhoto}
        onRemoveStaged={removeStaged}
        onPhotoClick={openLightbox}
        isDeletePending={deletePhoto.isPending}
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
