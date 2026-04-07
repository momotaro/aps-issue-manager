"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PendingPin {
  worldPosition: { x: number; y: number; z: number };
  screenPosition: { x: number; y: number };
  objectName: string;
  dbId: number | null;
}

export function usePlacementMode(viewer: Autodesk.Viewing.GuiViewer3D | null) {
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);
  const rafRef = useRef<number>(0);

  const enterPlacementMode = useCallback(() => {
    setIsPlacementMode(true);
  }, []);

  const exitPlacementMode = useCallback(() => {
    setIsPlacementMode(false);
  }, []);

  const clearPendingPin = useCallback(() => {
    setPendingPin(null);
  }, []);

  // Cursor management
  useEffect(() => {
    if (!viewer?.container) return;
    viewer.container.style.cursor = isPlacementMode ? "crosshair" : "";
    return () => {
      try {
        if (viewer?.container) {
          viewer.container.style.cursor = "";
        }
      } catch {
        // viewer が dispose 済みの場合は無視
      }
    };
  }, [isPlacementMode, viewer]);

  // Click handler for hit testing
  useEffect(() => {
    if (!viewer || !isPlacementMode) return;

    const handleClick = (event: MouseEvent) => {
      const rect = viewer.container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hit = viewer.impl.hitTest(x, y, false);

      if (!hit) return;

      const wp = hit.intersectPoint;
      const screenPt = viewer.worldToClient(
        new THREE.Vector3(wp.x, wp.y, wp.z),
      );

      const pinBase = {
        worldPosition: { x: wp.x, y: wp.y, z: wp.z },
        screenPosition: { x: screenPt.x, y: screenPt.y },
        dbId: hit.dbId ?? null,
      };

      setPendingPin({ ...pinBase, objectName: "" });
      setIsPlacementMode(false);

      viewer.getProperties(
        hit.dbId,
        (result) => {
          setPendingPin((prev) =>
            prev ? { ...prev, objectName: result.name } : null,
          );
        },
        () => {
          // getProperties failed — keep pin with empty objectName
        },
      );
    };

    viewer.container.addEventListener("click", handleClick);
    return () => {
      viewer.container.removeEventListener("click", handleClick);
    };
  }, [viewer, isPlacementMode]);

  // ESC key to exit placement mode
  useEffect(() => {
    if (!isPlacementMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPlacementMode(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlacementMode]);

  // Track pending pin screen position on camera change
  useEffect(() => {
    if (!viewer || !pendingPin) return;

    const updateScreenPosition = () => {
      const wp = pendingPin.worldPosition;
      const screenPt = viewer.worldToClient(
        new THREE.Vector3(wp.x, wp.y, wp.z),
      );
      setPendingPin((prev) =>
        prev
          ? { ...prev, screenPosition: { x: screenPt.x, y: screenPt.y } }
          : null,
      );
    };

    const onCameraChange = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateScreenPosition);
    };

    viewer.addEventListener(
      Autodesk.Viewing.CAMERA_CHANGE_EVENT,
      onCameraChange,
    );
    return () => {
      cancelAnimationFrame(rafRef.current);
      viewer.removeEventListener(
        Autodesk.Viewing.CAMERA_CHANGE_EVENT,
        onCameraChange,
      );
    };
  }, [viewer, pendingPin]);

  return {
    isPlacementMode,
    pendingPin,
    enterPlacementMode,
    exitPlacementMode,
    clearPendingPin,
  };
}
