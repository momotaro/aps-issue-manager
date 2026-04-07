"use client";

import { useCallback } from "react";
import type { IssueListItem } from "@/repositories/issue-repository";

export function useCameraNavigation(
  viewer: Autodesk.Viewing.GuiViewer3D | null,
) {
  const navigateToIssue = useCallback(
    (issue: IssueListItem) => {
      if (!viewer || typeof THREE === "undefined") return;
      const wp = issue.position.worldPosition;
      const target = new THREE.Vector3(wp.x, wp.y, wp.z);
      // 現在の視線方向を維持しつつピン座標を中心に据える
      const eyeVec = viewer.navigation.getEyeVector().clone().normalize();
      const distance = 8;
      const eye = target.clone().sub(eyeVec.multiplyScalar(distance));
      viewer.navigation.setView(eye, target);
    },
    [viewer],
  );

  return { navigateToIssue };
}
