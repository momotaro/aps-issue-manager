import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollIntoViewWhenSelected } from "./issue-card.hooks";

// renderHook 内では ref.current が DOM に接続されないため、手動でセットする
function attachElement(ref: { current: HTMLButtonElement | null }) {
  const el = document.createElement("button");
  document.body.appendChild(el);
  ref.current = el;
  return () => document.body.removeChild(el);
}

describe("useScrollIntoViewWhenSelected", () => {
  let scrollIntoViewSpy: ReturnType<typeof vi.spyOn>;
  let cleanupElement: (() => void) | null = null;

  beforeEach(() => {
    scrollIntoViewSpy = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    cleanupElement?.();
    cleanupElement = null;
    vi.restoreAllMocks();
  });

  it("isSelected が false のとき scrollIntoView を呼ばない", () => {
    const { result } = renderHook(() => useScrollIntoViewWhenSelected(false));
    cleanupElement = attachElement(
      result.current as { current: HTMLButtonElement | null },
    );
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  it("isSelected が true になったとき scrollIntoView を呼ぶ", () => {
    const { result, rerender } = renderHook(
      ({ isSelected }) => useScrollIntoViewWhenSelected(isSelected),
      { initialProps: { isSelected: false } },
    );
    cleanupElement = attachElement(
      result.current as { current: HTMLButtonElement | null },
    );

    act(() => rerender({ isSelected: true }));

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
    });
  });

  it("isSelected が true のまま変わらないとき scrollIntoView を再度呼ばない", () => {
    const { result, rerender } = renderHook(
      ({ isSelected }) => useScrollIntoViewWhenSelected(isSelected),
      { initialProps: { isSelected: false } },
    );
    cleanupElement = attachElement(
      result.current as { current: HTMLButtonElement | null },
    );

    // false → true で 1 回呼ばれる
    act(() => rerender({ isSelected: true }));
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);

    // true → true（変化なし）では追加で呼ばれない
    act(() => rerender({ isSelected: true }));
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
  });

  it("isSelected が true → false → true と変化したとき都度 scrollIntoView を呼ぶ", () => {
    const { result, rerender } = renderHook(
      ({ isSelected }) => useScrollIntoViewWhenSelected(isSelected),
      { initialProps: { isSelected: false } },
    );
    cleanupElement = attachElement(
      result.current as { current: HTMLButtonElement | null },
    );

    act(() => rerender({ isSelected: true }));
    act(() => rerender({ isSelected: false }));
    act(() => rerender({ isSelected: true }));

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
  });
});
