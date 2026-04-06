"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IssuePin } from "./types";

interface PinScreenPosition {
  pin: IssuePin;
  x: number;
  y: number;
  visible: boolean;
}

export function useIssuePins(
  viewer: Autodesk.Viewing.GuiViewer3D | null,
  issues: IssuePin[],
) {
  const [positions, setPositions] = useState<PinScreenPosition[]>([]);
  const [selectedPin, setSelectedPin] = useState<IssuePin | null>(null);
  const rafRef = useRef<number>(0);

  const updatePositions = useCallback(() => {
    if (!viewer?.container) return;

    try {
      const updated = issues.map((pin) => {
        const worldPt = new THREE.Vector3(
          pin.worldPosition.x,
          pin.worldPosition.y,
          pin.worldPosition.z,
        );
        const screenPt = viewer.worldToClient(worldPt);

        const containerRect = viewer.container.getBoundingClientRect();
        const visible =
          screenPt.x >= 0 &&
          screenPt.x <= containerRect.width &&
          screenPt.y >= 0 &&
          screenPt.y <= containerRect.height &&
          screenPt.z >= 0 &&
          screenPt.z <= 1;

        return { pin, x: screenPt.x, y: screenPt.y, visible };
      });

      setPositions(updated);
    } catch {
      // viewer が dispose 済みの場合は無視
    }
  }, [viewer, issues]);

  useEffect(() => {
    if (!viewer) return;

    const onCameraChange = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updatePositions);
    };

    viewer.addEventListener(
      Autodesk.Viewing.CAMERA_CHANGE_EVENT,
      onCameraChange,
    );
    updatePositions();

    return () => {
      cancelAnimationFrame(rafRef.current);
      viewer.removeEventListener(
        Autodesk.Viewing.CAMERA_CHANGE_EVENT,
        onCameraChange,
      );
    };
  }, [viewer, updatePositions]);

  const handlePinClick = useCallback((pin: IssuePin) => {
    setSelectedPin((prev) => (prev?.id === pin.id ? null : pin));
  }, []);

  const closePopup = useCallback(() => {
    setSelectedPin(null);
  }, []);

  return { positions, selectedPin, handlePinClick, closePopup };
}
