"use client";

/**
 * viewer ページのメインクライアントコンポーネント。
 *
 * @remarks
 * レイアウト: `APSViewer (flex-1) | IssuePanel (400px) | IssueListPanel (320px)`
 *
 * - ピンクリック → `selectedIssueId` を更新し、IssuePanel が Edit モードに切り替わる
 * - 「追加」ボタン → 配置モードへ、pendingPin + 事前 issueId を IssuePanel に渡して Add モード
 * - ユーザー切替は Header の UserSwitcher から行う（mock ユーザー 2 名）
 */

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSharedApsViewer } from "@/components/aps-viewer-provider";
import { ViewerSlot } from "@/components/viewer-slot";
import { TEMP_PROJECT_ID } from "@/lib/constants";
import { generateBase62Id } from "@/lib/generate-id";
import { useCameraNavigation } from "./camera-navigation.hooks";
import { useIssueDetail } from "./issue-detail.hooks";
import { useIssueFilters } from "./issue-filters.hooks";
import { IssueListPanel } from "./issue-list-panel";
import { IssuePanel, type PendingPinPayload } from "./issue-panel";
import {
  EditingPinMarker,
  IssuePinsOverlay,
  PendingPinMarker,
  PlacementModeOverlay,
} from "./issue-pins";
import { useIssuePins } from "./issue-pins.hooks";
import { useIssueList, useIssues } from "./issues-state.hooks";
import { useListPanel } from "./list-panel.hooks";
import { ListToggleBar } from "./list-toggle-bar";
import { usePlacementMode } from "./placement-mode.hooks";
import type { IssuePin } from "./types";

// base62 エンコードされた UUID v7 は short-uuid で常に 22 文字
const BASE62_RE = /^[0-9A-Za-z]{22}$/;

export function ViewerClient() {
  return <ViewerClientInner />;
}

function ViewerClientInner() {
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

  const {
    isPlacementMode,
    pendingPin,
    enterPlacementMode,
    exitPlacementMode,
    clearPendingPin,
  } = usePlacementMode(viewer);

  // 選択中の Issue ID（ピンクリック / 一覧クリックで更新）
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Pin 選択
  const selectedPin = selectedIssueId
    ? (issues.find((p) => p.id === selectedIssueId) ?? null)
    : null;

  // issue-pins は Dispatch<SetStateAction<IssuePin|null>> を要求するため
  // ID 状態に変換する薄いラッパーを通す
  const setSelectedPin = useCallback<
    React.Dispatch<React.SetStateAction<IssuePin | null>>
  >(
    (value) => {
      setSelectedIssueId((currentId) => {
        const currentPin = currentId
          ? (issues.find((p) => p.id === currentId) ?? null)
          : null;
        const next =
          typeof value === "function"
            ? (value as (prev: IssuePin | null) => IssuePin | null)(currentPin)
            : value;
        return next?.id ?? null;
      });
    },
    [issues],
  );

  const { positions, handlePinClick } = useIssuePins(
    viewer,
    issues,
    setSelectedPin,
  );

  // pendingPin が立ったら selected をクリア
  useEffect(() => {
    if (pendingPin) setSelectedIssueId(null);
  }, [pendingPin]);

  // Add モード用の事前生成 issueId（pendingPin のライフサイクルに連動）
  const preIssueIdRef = useRef<string | null>(null);
  if (pendingPin && !preIssueIdRef.current) {
    preIssueIdRef.current = generateBase62Id();
  }
  if (!pendingPin) {
    preIssueIdRef.current = null;
  }
  const preIssueId = preIssueIdRef.current;

  // List panel
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

  // IssuePanel は「ピン選択中」または「追加モード」のときのみ表示する
  const showIssuePanel =
    selectedIssueId !== null || (pendingPin !== null && preIssueId !== null);

  // パネル開閉時に APS Viewer をリサイズ
  useEffect(() => {
    if (!viewer) return;
    void isListOpen;
    void showIssuePanel;
    const timer = setTimeout(() => viewer.resize(), 50);
    return () => clearTimeout(timer);
  }, [viewer, isListOpen, showIssuePanel]);

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
  const navigatedIssueIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!targetIssue || !viewer) return;
    if (navigatedIssueIdRef.current === targetIssue.id) return;

    const doNavigate = () => {
      if (navigatedIssueIdRef.current === targetIssue.id) return;
      navigateToIssue(targetIssue);
      navigatedIssueIdRef.current = targetIssue.id;
    };

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

  // URL issueId に対応するピンを自動選択
  useEffect(() => {
    if (!targetIssueId) return;
    setSelectedIssueId(targetIssueId);
  }, [targetIssueId]);

  const handleAddFromList = useCallback(() => {
    setSelectedIssueId(null);
    enterPlacementMode();
  }, [enterPlacementMode]);

  const handleCardClick = useCallback(
    (issue: (typeof issueList)[number]) => {
      navigateToIssue(issue);
      setSelectedIssueId(issue.id);
    },
    [navigateToIssue],
  );

  const handlePanelClose = useCallback(() => {
    setSelectedIssueId(null);
    if (pendingPin) {
      exitPlacementMode();
      clearPendingPin();
    }
  }, [pendingPin, exitPlacementMode, clearPendingPin]);

  const handleAddSuccess = useCallback(() => {
    preIssueIdRef.current = null;
    clearPendingPin();
    exitPlacementMode();
  }, [clearPendingPin, exitPlacementMode]);

  // IssuePanel に渡す pendingPin ペイロード
  const pendingPinPayload: PendingPinPayload | null = pendingPin
    ? {
        worldPosition: pendingPin.worldPosition,
        ...(pendingPin.dbId != null && { dbId: pendingPin.dbId }),
        ...(pendingPin.objectName && { objectName: pendingPin.objectName }),
      }
    : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 relative">
          <ViewerSlot />
          {isPlacementMode && <PlacementModeOverlay />}

          {!combinedLoading && !combinedError && (
            <>
              <IssuePinsOverlay
                positions={positions}
                selectedPin={selectedPin}
                onPinClick={isPlacementMode ? () => {} : handlePinClick}
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
              {selectedIssueId &&
                (() => {
                  const editingPos = positions.find(
                    (p) => p.pin.id === selectedIssueId,
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
        </main>

        {showIssuePanel && (
          <IssuePanel
            selectedIssueId={selectedIssueId}
            pendingPin={pendingPinPayload}
            pendingIssueId={preIssueId}
            projectId={TEMP_PROJECT_ID}
            onClose={handlePanelClose}
            onAddSuccess={handleAddSuccess}
          />
        )}

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
            selectedIssueId={selectedIssueId ?? undefined}
          />
        ) : (
          <ListToggleBar onOpen={openList} />
        )}
      </div>
    </div>
  );
}
