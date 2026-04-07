"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useSharedApsViewer } from "@/components/aps-viewer-provider";
import { ViewerSlot } from "@/components/viewer-slot";
import { TEMP_PROJECT_ID, TEMP_REPORTER_ID } from "@/lib/constants";
import { generateBase62Id } from "@/lib/generate-id";
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

export function ViewerClient() {
  const searchParams = useSearchParams();
  const targetIssueId = searchParams.get("issueId");

  const { viewer, isLoading, error } = useSharedApsViewer();
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

  // パネル開閉時に APS Viewer をリサイズ
  const isFormOpen = pendingPin !== null;
  useEffect(() => {
    if (!viewer) return;
    // isListOpen / isFormOpen の変化でリサイズをトリガー
    void isListOpen;
    void isFormOpen;
    const timer = setTimeout(() => viewer.resize(), 50);
    return () => clearTimeout(timer);
  }, [viewer, isListOpen, isFormOpen]);

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

  // Camera navigation
  const { navigateToIssue } = useCameraNavigation(viewer);

  // issueId クエリパラメータによるカメラ移動（指摘一覧ページの 3D ボタンから遷移時）
  const { data: targetIssue } = useIssueDetail(targetIssueId);
  // 最後にナビゲートした issueId を保持し、targetIssueId が変わったら再ナビゲートする
  const navigatedIssueIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!targetIssue || !viewer) return;
    if (navigatedIssueIdRef.current === targetIssue.id) return;

    const doNavigate = () => {
      if (navigatedIssueIdRef.current === targetIssue.id) return;
      navigateToIssue(targetIssue);
      navigatedIssueIdRef.current = targetIssue.id;
    };

    // ジオメトリが完全にロードされてからカメラ移動
    if (viewer.model?.isLoadDone()) {
      doNavigate();
    } else {
      const onGeometryLoaded = () => {
        doNavigate();
        viewer.removeEventListener(
          Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
          onGeometryLoaded,
        );
      };
      viewer.addEventListener(
        Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
        onGeometryLoaded,
      );
      return () => {
        viewer.removeEventListener(
          Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
          onGeometryLoaded,
        );
      };
    }
  }, [targetIssue, viewer, navigateToIssue]);

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
    <div className="flex flex-1 overflow-hidden">
      <main className="flex-1 relative">
        {/* Persistent な APS Viewer の DOM をここに装着 */}
        <ViewerSlot />
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
