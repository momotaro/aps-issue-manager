"use client";

import { useEffect, useRef } from "react";

export function useScrollIntoViewWhenSelected(isSelected: boolean) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isSelected) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isSelected]);
  return ref;
}
