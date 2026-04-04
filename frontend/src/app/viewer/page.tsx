"use client";

import { ApsViewer } from "./aps-viewer";
import { useApsViewer } from "./aps-viewer.hooks";
import type { IssueFormValues } from "./issue-form";
import { IssueFormPanel } from "./issue-form";
import { IssuePinsOverlay, PinMarker } from "./issue-pins";
import { useIssuePins } from "./issue-pins.hooks";
import { useCreateIssue, useIssues } from "./issues-state.hooks";
import { usePlacementMode } from "./placement-mode.hooks";

// TODO: 認証実装後に動的に取得する
const TEMP_PROJECT_ID = "0000000000000000000001";
const TEMP_REPORTER_ID = "0000000000000000000001";

export default function ViewerPage() {
  const { containerRef, viewer, isLoading, error } = useApsViewer();
  const { data: issues = [], isLoading: issuesLoading } = useIssues();
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

  const isFormOpen = pendingPin !== null;

  const handleFormSubmit = (data: IssueFormValues) => {
    if (!pendingPin) return;
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
        onSuccess: () => {
          clearPendingPin();
        },
      },
    );
  };

  const handleFormCancel = () => {
    clearPendingPin();
  };

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
          isLoading={isLoading || issuesLoading}
          error={error}
        />
        {!isLoading && !error && (
          <>
            <IssuePinsOverlay
              positions={positions}
              selectedPin={selectedPin}
              onPinClick={isPlacementMode ? () => {} : handlePinClick}
              onClose={closePopup}
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
      </main>
      <IssueFormPanel
        isOpen={isFormOpen}
        defaultTitle={pendingPin?.objectName}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
        isSubmitting={createIssue.isPending}
      />
    </div>
  );
}
