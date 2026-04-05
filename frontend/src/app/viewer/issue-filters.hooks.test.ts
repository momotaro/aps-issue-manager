import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIssueFilters } from "./issue-filters.hooks";

describe("useIssueFilters", () => {
  it("初期状態ではフィルタが未選択", () => {
    const { result } = renderHook(() => useIssueFilters());
    expect(result.current.filters).toEqual({});
  });

  it("ステータスフィルタを設定できる", () => {
    const { result } = renderHook(() => useIssueFilters());
    act(() => result.current.setStatus("open"));
    expect(result.current.filters.status).toBe("open");
  });

  it("ステータスフィルタを解除できる", () => {
    const { result } = renderHook(() => useIssueFilters());
    act(() => result.current.setStatus("open"));
    act(() => result.current.setStatus(undefined));
    expect(result.current.filters.status).toBeUndefined();
  });

  it("種別フィルタを設定できる", () => {
    const { result } = renderHook(() => useIssueFilters());
    act(() => result.current.setCategory("safety_hazard"));
    expect(result.current.filters.category).toBe("safety_hazard");
  });

  it("種別フィルタを解除できる", () => {
    const { result } = renderHook(() => useIssueFilters());
    act(() => result.current.setCategory("safety_hazard"));
    act(() => result.current.setCategory(undefined));
    expect(result.current.filters.category).toBeUndefined();
  });

  it("複合フィルタを設定できる", () => {
    const { result } = renderHook(() => useIssueFilters());
    act(() => result.current.setStatus("in_progress"));
    act(() => result.current.setCategory("quality_defect"));
    expect(result.current.filters).toEqual({
      status: "in_progress",
      category: "quality_defect",
    });
  });
});
