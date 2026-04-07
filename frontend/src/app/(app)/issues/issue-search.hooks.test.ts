import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

const { useIssueSearch } = await import("./issue-search.hooks");

describe("useIssueSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初期状態のデフォルト値が正しい", () => {
    const { result } = renderHook(() => useIssueSearch());
    expect(result.current.keyword).toBe("");
    expect(result.current.debouncedKeyword).toBe("");
    expect(result.current.status).toBeUndefined();
    expect(result.current.category).toBeUndefined();
    expect(result.current.sortBy).toBe("createdAt");
    expect(result.current.sortOrder).toBe("desc");
  });

  it("キーワード変更がデバウンスされる", () => {
    const { result } = renderHook(() => useIssueSearch());
    act(() => result.current.setKeyword("テスト"));
    expect(result.current.keyword).toBe("テスト");
    expect(result.current.debouncedKeyword).toBe("");

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.debouncedKeyword).toBe("テスト");
  });

  it("デバウンス中の連続入力は最後の値のみ反映される", () => {
    const { result } = renderHook(() => useIssueSearch());
    act(() => result.current.setKeyword("テ"));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.setKeyword("テスト"));
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.debouncedKeyword).toBe("テスト");
  });

  it("ステータスフィルタを設定・解除できる", () => {
    const { result } = renderHook(() => useIssueSearch());
    act(() => result.current.setStatus("open"));
    expect(result.current.status).toBe("open");
    act(() => result.current.setStatus(undefined));
    expect(result.current.status).toBeUndefined();
  });

  it("種別フィルタを設定・解除できる", () => {
    const { result } = renderHook(() => useIssueSearch());
    act(() => result.current.setCategory("safety_hazard"));
    expect(result.current.category).toBe("safety_hazard");
    act(() => result.current.setCategory(undefined));
    expect(result.current.category).toBeUndefined();
  });

  it("toggleSort: 同じカラムで方向が切り替わる", () => {
    const { result } = renderHook(() => useIssueSearch());
    expect(result.current.sortBy).toBe("createdAt");
    expect(result.current.sortOrder).toBe("desc");

    act(() => result.current.toggleSort("createdAt"));
    expect(result.current.sortOrder).toBe("asc");

    act(() => result.current.toggleSort("createdAt"));
    expect(result.current.sortOrder).toBe("desc");
  });

  it("toggleSort: 別カラムに切り替わると desc にリセット", () => {
    const { result } = renderHook(() => useIssueSearch());
    act(() => result.current.toggleSort("createdAt"));
    expect(result.current.sortOrder).toBe("asc");

    act(() => result.current.toggleSort("updatedAt"));
    expect(result.current.sortBy).toBe("updatedAt");
    expect(result.current.sortOrder).toBe("desc");
  });

  it("queryFilters がフィルタ状態を反映する", () => {
    const { result } = renderHook(() => useIssueSearch());
    act(() => result.current.setStatus("open"));
    act(() => result.current.setCategory("quality_defect"));

    expect(result.current.queryFilters).toEqual(
      expect.objectContaining({
        status: "open",
        category: "quality_defect",
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    );
  });
});
