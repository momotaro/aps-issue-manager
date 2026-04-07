"use client";

import { useEffect, useRef } from "react";
import { useSharedApsViewer } from "./aps-viewer-provider";

/**
 * Viewer の DOM をこのスロットに装着するコンポーネント。
 *
 * mount 時に Viewer の DOM を host から自身の中に物理的に移動する。
 * unmount 時には host に戻すことで、Viewer インスタンスを破棄せずに
 * 別ページから戻ってきた時に再利用可能にする。
 */
export function ViewerSlot() {
  const slotRef = useRef<HTMLDivElement>(null);
  const { containerRef, viewer, isLoading, error, requestInit } =
    useSharedApsViewer();

  // ViewerSlot がマウントされた時点で Viewer の初期化を開始する
  useEffect(() => {
    requestInit();
  }, [requestInit]);

  // DOM 移動は mount/unmount のみ。viewer の初期化で再付け替えが起きないよう
  // viewer は依存配列に含めない。
  useEffect(() => {
    const slot = slotRef.current;
    const container = containerRef.current;
    if (!slot || !container) return;

    const previousParent = container.parentElement;
    slot.appendChild(container);

    return () => {
      if (previousParent) previousParent.appendChild(container);
    };
  }, [containerRef]);

  // DOM 移動後 / viewer 初期化後に canvas をリサイズ
  useEffect(() => {
    if (!viewer) return;
    const timer = setTimeout(() => viewer.resize(), 50);
    return () => clearTimeout(timer);
  }, [viewer]);

  return (
    <div ref={slotRef} className="absolute inset-0">
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-800" />
            <p className="text-sm text-zinc-600">モデルを読み込み中...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 z-10">
          <div className="flex flex-col items-center gap-3 max-w-md px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <span className="text-red-600 text-xl">!</span>
            </div>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
