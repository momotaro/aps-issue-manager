"use client";

import { useCallback } from "react";
import type { IssueListItem } from "@/repositories/issue-repository";

export function useCameraNavigation(
  viewer: Autodesk.Viewing.GuiViewer3D | null,
) {
  const navigateToIssue = useCallback(
    (issue: IssueListItem) => {
      if (!viewer || typeof THREE === "undefined") return;
      const pos = issue.position;
      if (pos.type === "component" && pos.dbId != null) {
        viewer.fitToView([pos.dbId]);
      } else {
        const target = new THREE.Vector3(
          pos.worldPosition.x,
          pos.worldPosition.y,
          pos.worldPosition.z,
        );
        const eye = target.clone().add(new THREE.Vector3(5, 5, 5));
        viewer.navigation.setView(eye, target);
      }
    },
    [viewer],
  );

  return { navigateToIssue };
}
