import type { RefObject } from "react";

interface ApsViewerProps {
  containerRef: RefObject<HTMLDivElement | null>;
  isLoading: boolean;
  error: string | null;
}

export function ApsViewer({ containerRef, isLoading, error }: ApsViewerProps) {
  return (
    <>
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
      <div ref={containerRef} className="absolute inset-0" />
    </>
  );
}
