"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSharedApsViewer } from "@/components/aps-viewer-provider";
import { ViewerSlot } from "@/components/viewer-slot";
import { TEMP_PROJECT_ID, TEMP_REPORTER_ID } from "@/lib/constants";
import { generateBase62Id } from "@/lib/generate-id";
import { useCameraNavigation } from "./camera-navigation.hooks";
import { useIssueFilters } from "./issue-filters.hooks";
import { IssueFormPanel } from "./issue-form";
import type { IssueFormValues } from "./issue-form.hooks";
import { IssueListPanel } from "./issue-list-panel";
import {
  EditingPinMarker,
  IssuePinsOverlay,
  PendingPinMarker,
  PlacementModeOverlay,
} from "./issue-pins";
import { useIssuePins } from "./issue-pins.hooks";
import {
  useCreateIssue,
  useIssueList,
  useIssues,
  useUpdateIssue,
} from "./issues-state.hooks";
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
import type { IssuePin } from "./types";

// base62 エンコードされた UUID v7 は short-uuid で常に 22 文字
const BASE62_RE = /^[0-9A-Za-z]{22}$/;

export function ViewerClient() {
  const searchParams = useSearchParams();
  const rawIssueId = searchParams.get("issueId");
  const targetIssueId =
    rawIssueId && BASE62_RE.test(rawIssueId) ? rawIssueId : null;

  const { viewer, isLoading, error } = useSharedApsViewer();
  const {
    data: issues = [],
    isLoading: issuesLoading,
    error: issuesError,
  } = useIssues(TEMP_PROJECT_ID);
  const createIssue = useCreateIssue();
  const updateIssue = useUpdateIssue();
  const {
    isPlacementMode,
    pendingPin,
    enterPlacementMode,
    exitPlacementMode,
    clearPendingPin,
  } = usePlacementMode(viewer);

  // selectedPin を viewer-client で一元管理（一覧パネルとの共有のため）
  const [selectedPin, setSelectedPin] = useState<IssuePin | null>(null);
  // 編集中の Issue ID（追加フォームと排他的）
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);

  const { positions, handlePinClick, closePopup } = useIssuePins(
    viewer,
    issues,
    setSelectedPin,
  );

  // pendingPin（追加中）と selectedPin（詳細表示中）は排他的
  useEffect(() => {
    if (pendingPin) {
      setSelectedPin(null);
      setEditingIssueId(null);
    }
  }, [pendingPin]);

  // editingIssueId が設定されたら pendingPin と selectedPin をクリア
  useEffect(() => {
    if (editingIssueId) {
      clearPendingPin();
      setSelectedPin(null);
    }
  }, [editingIssueId, clearPendingPin]);

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
  const isFormOpen = pendingPin !== null || editingIssueId !== null;
  const formMode: "create" | "edit" =
    editingIssueId !== null ? "edit" : "create";

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

  // Issue detail: 選択中ピンの詳細（PinPopup 表示用）
  const { data: selectedPinDetail } = useIssueDetail(selectedPin?.id ?? null);

  // Issue detail: 編集対象の詳細（フォーム prefill 用）
  const { data: editingIssueDetail } = useIssueDetail(editingIssueId);

  // Issue detail: 写真操作のアクティブ対象（create 時は preIssueId、edit 時は editingIssueId）
  const photoActiveIssueId = editingIssueId ?? preIssueId ?? comparison.issueId;
  // preIssueId は作成成功後のみ detail を取得（未作成時は 404 になるため）
  const issueDetailId =
    (createIssue.isSuccess ? preIssueId : null) ??
    editingIssueId ??
    comparison.issueId;
  const { data: issueDetail } = useIssueDetail(issueDetailId);
  const {
    uploading,
    pendingConfirms,
    addFiles,
    confirmPending,
    cleanup: cleanupUploads,
  } = usePhotoUpload(photoActiveIssueId, TEMP_REPORTER_ID);
  const deletePhoto = useDeletePhoto(photoActiveIssueId);

  // モード切替（editingIssueId の変化）時に残留アップロードをクリア
  // ※ このeffectは cleanupUploads の宣言後に置く必要がある
  // biome-ignore lint/correctness/useExhaustiveDependencies: editingIssueId はエフェクトのトリガーとして必要だが本体では使用しない
  useEffect(() => {
    cleanupUploads();
  }, [editingIssueId, cleanupUploads]);

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

  // URL issueId に対応するピンの詳細カードを自動オープン
  // issues と targetIssueId を別々に監視することで、issues が後から読み込まれても確実に pin を選択できる
  useEffect(() => {
    if (!targetIssueId) return;
    const pin = issues.find((p) => p.id === targetIssueId);
    if (pin) setSelectedPin(pin);
  }, [targetIssueId, issues]);

  const handleAddFromList = useCallback(() => {
    cleanupUploads(); // 編集モードの残留アップロードをクリア
    closeComparison();
    setSelectedPin(null);
    setEditingIssueId(null);
    enterPlacementMode();
  }, [enterPlacementMode, cleanupUploads, closeComparison]);

  const handleCardClick = useCallback(
    (issue: (typeof issueList)[number]) => {
      navigateToIssue(issue);
      const pin = issues.find((p) => p.id === issue.id);
      if (pin) setSelectedPin(pin);
    },
    [navigateToIssue, issues],
  );

  const handleEditClick = useCallback(
    (issueId: string) => {
      cleanupUploads(); // 追加/別編集モードの残留アップロードをクリア
      closeComparison();
      setEditingIssueId(issueId);
    },
    [cleanupUploads, closeComparison],
  );

  const handleFormSubmit = useCallback(
    (data: IssueFormValues) => {
      if (formMode === "edit" && editingIssueId) {
        updateIssue.mutate(
          {
            id: editingIssueId,
            actorId: TEMP_REPORTER_ID,
            // editingIssueDetail が未ロードの場合は空値を prev にして全フィールドを必ず送る
            prev: editingIssueDetail
              ? {
                  title: editingIssueDetail.title,
                  description: editingIssueDetail.description,
                  category: editingIssueDetail.category,
                  status: editingIssueDetail.status,
                }
              : {
                  title: "",
                  description: "",
                  category: "quality_defect" as const,
                  status: "open" as const,
                },
            next: {
              title: data.title,
              description: data.description,
              category: data.category,
              status: data.status,
            },
          },
          {
            onSuccess: () => {
              // 写真を先に confirm してから cleanup する
              confirmPending();
              setEditingIssueId(null);
              cleanupUploads();
            },
          },
        );
        return;
      }

      // Create mode
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
    [
      formMode,
      editingIssueId,
      editingIssueDetail,
      updateIssue,
      cleanupUploads,
      pendingPin,
      preIssueId,
      createIssue,
      confirmPending,
      clearPendingPin,
    ],
  );

  const handleFormCancel = useCallback(() => {
    preIssueIdRef.current = null;
    createIssue.reset();
    cleanupUploads();
    exitPlacementMode();
    clearPendingPin();
    setEditingIssueId(null);
  }, [createIssue, cleanupUploads, exitPlacementMode, clearPendingPin]);

  const handleDeletePhoto = useCallback(
    (photoId: string) => {
      deletePhoto.mutate({ photoId, actorId: TEMP_REPORTER_ID });
    },
    [deletePhoto],
  );

  const photos = issueDetail?.photos ?? [];

  // 編集フォームの初期値
  const editInitialValues = editingIssueDetail
    ? {
        title: editingIssueDetail.title,
        description: editingIssueDetail.description,
        category: editingIssueDetail.category,
        status: editingIssueDetail.status,
      }
    : undefined;

  // IssueFormPanel の right 位置: リストパネル表示時は 320px、非表示時は 36px
  const formRightClass = isListOpen ? "right-80" : "right-9";

  const isUpdating = updateIssue.isPending;

  return (
    <div className="flex flex-1 overflow-hidden">
      <main className="flex-1 relative">
        {/* Persistent な APS Viewer の DOM をここに装着 */}
        <ViewerSlot />
        {/* 指摘追加モード中のオーバーレイバナー */}
        {isPlacementMode && <PlacementModeOverlay />}

        {!combinedLoading && !combinedError && (
          <>
            <IssuePinsOverlay
              positions={positions}
              selectedPin={selectedPin}
              onPinClick={isPlacementMode ? () => {} : handlePinClick}
              onClose={closePopup}
              onComparePhotos={openComparison}
              onEdit={handleEditClick}
              issueDetail={selectedPinDetail}
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
                  <PendingPinMarker />
                </div>
              </div>
            )}
            {editingIssueId &&
              (() => {
                const editingPos = positions.find(
                  (p) => p.pin.id === editingIssueId,
                );
                return editingPos?.visible ? (
                  <div className="absolute inset-0 pointer-events-none z-20">
                    <div
                      className="absolute -translate-x-1/2 -translate-y-full"
                      style={{ left: editingPos.x, top: editingPos.y }}
                    >
                      <EditingPinMarker status={editingPos.pin.status} />
                    </div>
                  </div>
                ) : null;
              })()}
          </>
        )}

        {/* Photo Comparison overlay */}
        {comparison.isOpen && comparison.issueId && (
          <div className="absolute bottom-4 left-4 z-30 w-[480px]">
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
          onCardClick={handleCardClick}
          selectedIssueId={selectedPin?.id}
        />
      ) : (
        <ListToggleBar onOpen={openList} />
      )}

      <IssueFormPanel
        isOpen={isFormOpen}
        mode={formMode}
        resetKey={editingIssueId}
        initialValues={
          formMode === "edit"
            ? editInitialValues
            : pendingPin?.objectName
              ? { title: pendingPin.objectName }
              : undefined
        }
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
        isSubmitting={createIssue.isPending || isUpdating}
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
