"use client";

import { useCallback, useState } from "react";

type LightboxState = {
  isOpen: boolean;
  currentIndex: number;
};

type ComparisonState = {
  isOpen: boolean;
  issueId: string | null;
};

export function usePhotoViewer() {
  const [lightbox, setLightbox] = useState<LightboxState>({
    isOpen: false,
    currentIndex: 0,
  });
  const [comparison, setComparison] = useState<ComparisonState>({
    isOpen: false,
    issueId: null,
  });

  const openLightbox = useCallback((index: number) => {
    setLightbox({ isOpen: true, currentIndex: index });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox({ isOpen: false, currentIndex: 0 });
  }, []);

  const navigateLightbox = useCallback((index: number) => {
    setLightbox((prev) => ({ ...prev, currentIndex: index }));
  }, []);

  const openComparison = useCallback((issueId: string) => {
    setComparison({ isOpen: true, issueId });
  }, []);

  const closeComparison = useCallback(() => {
    setComparison({ isOpen: false, issueId: null });
  }, []);

  return {
    lightbox,
    openLightbox,
    closeLightbox,
    navigateLightbox,
    comparison,
    openComparison,
    closeComparison,
  };
}
