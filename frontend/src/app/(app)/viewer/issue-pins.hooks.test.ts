import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useIssuePins } from "./issue-pins.hooks";
import type { IssuePin } from "./types";

const pin1: IssuePin = {
  id: "pin1",
  title: "テストピン1",
  status: "open",
  category: "quality_defect",
  worldPosition: { x: 0, y: 0, z: 0 },
  photoCount: 0,
};

const pin2: IssuePin = {
  id: "pin2",
  title: "テストピン2",
  status: "in_progress",
  category: "safety_hazard",
  worldPosition: { x: 1, y: 1, z: 1 },
  photoCount: 2,
};

describe("useIssuePins", () => {
  it("handlePinClick で setSelectedPin が呼ばれる", () => {
    const setSelectedPin = vi.fn();
    const { result } = renderHook(() =>
      useIssuePins(null, [pin1, pin2], setSelectedPin),
    );

    act(() => result.current.handlePinClick(pin1));

    expect(setSelectedPin).toHaveBeenCalledTimes(1);
  });

  it("handlePinClick は関数型 updater を渡す（トグルロジックを保持）", () => {
    const setSelectedPin = vi.fn();
    const { result } = renderHook(() =>
      useIssuePins(null, [pin1, pin2], setSelectedPin),
    );

    act(() => result.current.handlePinClick(pin1));

    // 関数型 updater が渡されていることを確認
    const updater = setSelectedPin.mock.calls[0][0];
    expect(typeof updater).toBe("function");
  });

  it("handlePinClick のトグルロジック: 別ピンを渡すと新しいピンが返る", () => {
    const setSelectedPin = vi.fn();
    const { result } = renderHook(() =>
      useIssuePins(null, [pin1, pin2], setSelectedPin),
    );

    act(() => result.current.handlePinClick(pin2));

    const updater = setSelectedPin.mock.calls[0][0];
    // prev が pin1（異なるピン）→ pin2 を返す
    expect(updater(pin1)).toBe(pin2);
  });

  it("handlePinClick のトグルオフ: 同じピンを渡すと null が返る", () => {
    const setSelectedPin = vi.fn();
    const { result } = renderHook(() =>
      useIssuePins(null, [pin1, pin2], setSelectedPin),
    );

    act(() => result.current.handlePinClick(pin1));

    const updater = setSelectedPin.mock.calls[0][0];
    // prev が pin1（同じピン）→ null を返す（トグルオフ）
    expect(updater(pin1)).toBeNull();
  });

  it("handlePinClick のトグルオフ: 同一 ID・異なるインスタンスでも null が返る", () => {
    const setSelectedPin = vi.fn();
    const { result } = renderHook(() =>
      useIssuePins(null, [pin1, pin2], setSelectedPin),
    );

    act(() => result.current.handlePinClick(pin1));

    const updater = setSelectedPin.mock.calls[0][0];
    // ID が同じ別インスタンスでも ID 比較でトグルオフになる
    const pin1Copy = { ...pin1 };
    expect(updater(pin1Copy)).toBeNull();
  });

  it("handlePinClick のトグルロジック: prev が null でも新しいピンが返る", () => {
    const setSelectedPin = vi.fn();
    const { result } = renderHook(() =>
      useIssuePins(null, [pin1, pin2], setSelectedPin),
    );

    act(() => result.current.handlePinClick(pin1));

    const updater = setSelectedPin.mock.calls[0][0];
    // prev が null → pin1 を返す
    expect(updater(null)).toBe(pin1);
  });

  it("closePopup で setSelectedPin(null) が呼ばれる", () => {
    const setSelectedPin = vi.fn();
    const { result } = renderHook(() =>
      useIssuePins(null, [pin1, pin2], setSelectedPin),
    );

    act(() => result.current.closePopup());

    expect(setSelectedPin).toHaveBeenCalledWith(null);
  });

  it("closePopup は selectedPin が null でも正常に動作する（冪等）", () => {
    const setSelectedPin = vi.fn();
    const { result } = renderHook(() =>
      useIssuePins(null, [pin1, pin2], setSelectedPin),
    );

    expect(() => {
      act(() => result.current.closePopup());
      act(() => result.current.closePopup());
    }).not.toThrow();

    expect(setSelectedPin).toHaveBeenCalledTimes(2);
    expect(setSelectedPin).toHaveBeenCalledWith(null);
  });

  it("viewer が null のとき handlePinClick がクラッシュしない", () => {
    const setSelectedPin = vi.fn();
    const { result } = renderHook(() => useIssuePins(null, [], setSelectedPin));

    expect(() => {
      act(() => result.current.handlePinClick(pin1));
    }).not.toThrow();
  });
});
