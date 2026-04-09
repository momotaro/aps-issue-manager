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

      if (hit) {
        const wp = hit.intersectPoint;
        const screenPt = viewer.worldToClient(
          new THREE.Vector3(wp.x, wp.y, wp.z),
        );

        setPendingPin({
          worldPosition: { x: wp.x, y: wp.y, z: wp.z },
          screenPosition: { x: screenPt.x, y: screenPt.y },
          dbId: hit.dbId ?? null,
          objectName: "",
        });

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
      } else {
        // 空間クリック時: カメラのFOVと向きベクトルからレイを計算
        const cam = viewer.impl.camera as unknown as {
          position: THREE.Vector3;
          fov: number;
          aspect: number;
          up: THREE.Vector3;
        };

        const eye = cam.position;
        const target = viewer.navigation.getTarget();
        const dist = Math.sqrt(
          (eye.x - target.x) ** 2 +
            (eye.y - target.y) ** 2 +
            (eye.z - target.z) ** 2,
        );

        // カメラ基底ベクトルを構築
        const fwd = new THREE.Vector3(
          target.x - eye.x,
          target.y - eye.y,
          target.z - eye.z,
        ).normalize();

        const worldUp = cam.up;

        // right = fwd × worldUp
        const right = new THREE.Vector3(
          fwd.y * worldUp.z - fwd.z * worldUp.y,
          fwd.z * worldUp.x - fwd.x * worldUp.z,
          fwd.x * worldUp.y - fwd.y * worldUp.x,
        ).normalize();

        // upOrtho = right × fwd（直交化した上方向）
        const upOrtho = new THREE.Vector3(
          right.y * fwd.z - right.z * fwd.y,
          right.z * fwd.x - right.x * fwd.z,
          right.x * fwd.y - right.y * fwd.x,
        );

        // NDC座標からレイ方向を計算
        const ndcX = (x / rect.width) * 2 - 1;
        const ndcY = -(y / rect.height) * 2 + 1;
        const aspect = cam.aspect ?? rect.width / rect.height;
        const tanHalfFovY = Math.tan(((cam.fov ?? 45) * Math.PI) / 180 / 2);
        const tanHalfFovX = tanHalfFovY * aspect;

        const rayDir = new THREE.Vector3(
          fwd.x + ndcX * tanHalfFovX * right.x + ndcY * tanHalfFovY * upOrtho.x,
          fwd.y + ndcX * tanHalfFovX * right.y + ndcY * tanHalfFovY * upOrtho.y,
          fwd.z + ndcX * tanHalfFovX * right.z + ndcY * tanHalfFovY * upOrtho.z,
        ).normalize();

        const wp = new THREE.Vector3(
          eye.x + rayDir.x * dist,
          eye.y + rayDir.y * dist,
          eye.z + rayDir.z * dist,
        );

        const screenPt = viewer.worldToClient(wp);

        setPendingPin({
          worldPosition: { x: wp.x, y: wp.y, z: wp.z },
          screenPosition: { x: screenPt.x, y: screenPt.y },
          objectName: "",
          dbId: null,
        });
      }
    };

    viewer.container.addEventListener("click", handleClick);
    return () => {
      viewer.container.removeEventListener("click", handleClick);
    };
  }, [viewer, isPlacementMode]);

  // ESC key to exit placement mode and cancel pending pin
  useEffect(() => {
    if (!isPlacementMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPlacementMode(false);
        setPendingPin(null);
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
