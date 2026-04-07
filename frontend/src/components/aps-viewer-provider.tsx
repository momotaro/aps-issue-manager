"use client";

import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useState,
} from "react";
import { useApsViewer } from "@/app/(app)/viewer/aps-viewer.hooks";

type ApsViewerContextValue = {
  /** Viewer がアタッチされる DOM 要素への ref */
  containerRef: RefObject<HTMLDivElement | null>;
  viewer: Autodesk.Viewing.GuiViewer3D | null;
  isLoading: boolean;
  error: string | null;
  /** ViewerSlot がマウントされた時点で呼び出し、初期化を開始する */
  requestInit: () => void;
};

const ApsViewerContext = createContext<ApsViewerContextValue | null>(null);

export function useSharedApsViewer(): ApsViewerContextValue {
  const ctx = useContext(ApsViewerContext);
  if (!ctx)
    throw new Error("useSharedApsViewer must be used within ApsViewerProvider");
  return ctx;
}

/**
 * APS Viewer のインスタンスを保持するプロバイダ。
 *
 * Viewer の DOM は常に host 要素に存在する。実際の表示位置は ViewerSlot で
 * DOM 移動して制御する。これにより画面遷移しても Viewer が破棄されない。
 *
 * 初期化は ViewerSlot がマウントされた時点（= /viewer ページに到達時）で開始する。
 * /issues だけ閲覧している間は APS トークン取得・スクリプト読み込みは行わない。
 */
export function ApsViewerProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const requestInit = useCallback(() => setEnabled(true), []);
  const viewerState = useApsViewer(enabled);
  const value = { ...viewerState, requestInit };

  return (
    <ApsViewerContext.Provider value={value}>
      {/* Viewer DOM のホスト: 非表示。slot にマウントされていない時はここに留まる */}
      <div id="aps-viewer-host" className="hidden">
        <div ref={value.containerRef} className="w-full h-full" />
      </div>
      {children}
    </ApsViewerContext.Provider>
  );
}
