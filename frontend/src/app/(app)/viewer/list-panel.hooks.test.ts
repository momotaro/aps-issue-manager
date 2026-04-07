import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useListPanel } from "./list-panel.hooks";

describe("useListPanel", () => {
  it("デフォルトでパネルが表示状態", () => {
    const { result } = renderHook(() => useListPanel());
    expect(result.current.isOpen).toBe(true);
  });

  it("初期値を false に設定できる", () => {
    const { result } = renderHook(() => useListPanel(false));
    expect(result.current.isOpen).toBe(false);
  });

  it("close でパネルを非表示にできる", () => {
    const { result } = renderHook(() => useListPanel());
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it("open でパネルを表示できる", () => {
    const { result } = renderHook(() => useListPanel(false));
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
  });

  it("toggle で状態を切り替えられる", () => {
    const { result } = renderHook(() => useListPanel());
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);
  });
});
