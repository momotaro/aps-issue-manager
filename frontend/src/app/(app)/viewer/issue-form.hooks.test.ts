import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAddIssueForm, useEditIssueForm } from "./issue-form.hooks";

describe("useAddIssueForm", () => {
  it("初回コメントが空のときバリデーションエラーになる", async () => {
    const { result } = renderHook(() => useAddIssueForm(true));
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await act(async () => {
      result.current.setValue("title", "配筋ピッチ不良");
      result.current.setValue("initialComment", "");
      await result.current.handleSubmit(onValid, onInvalid)();
    });
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(onInvalid.mock.calls[0][0].initialComment).toBeDefined();
    expect(onValid).not.toHaveBeenCalled();
  });

  it("タイトルが空のときバリデーションエラーになる", async () => {
    const { result } = renderHook(() => useAddIssueForm(true));
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await act(async () => {
      result.current.setValue("title", "");
      result.current.setValue("initialComment", "内容");
      await result.current.handleSubmit(onValid, onInvalid)();
    });
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(onInvalid.mock.calls[0][0].title).toBeDefined();
    expect(onValid).not.toHaveBeenCalled();
  });

  it("コメント 2000 文字超過でバリデーションエラーになる", async () => {
    const { result } = renderHook(() => useAddIssueForm(true));
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await act(async () => {
      result.current.setValue("title", "タイトル");
      result.current.setValue("initialComment", "a".repeat(2001));
      await result.current.handleSubmit(onValid, onInvalid)();
    });
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(onInvalid.mock.calls[0][0].initialComment).toBeDefined();
    expect(onValid).not.toHaveBeenCalled();
  });

  it("必須項目が揃っていればバリデーションを通る", async () => {
    const { result } = renderHook(() => useAddIssueForm(true));
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await act(async () => {
      result.current.setValue("title", "配筋ピッチ不良");
      result.current.setValue("category", "quality_defect");
      result.current.setValue("assigneeId", null);
      result.current.setValue("initialComment", "最初のコメント");
      await result.current.handleSubmit(onValid, onInvalid)();
    });
    expect(onValid).toHaveBeenCalledTimes(1);
    expect(onInvalid).not.toHaveBeenCalled();
  });
});

describe("useEditIssueForm", () => {
  it("assigneeId は null でも通る", async () => {
    const { result } = renderHook(() => useEditIssueForm(true));
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await act(async () => {
      result.current.setValue("title", "タイトル");
      result.current.setValue("category", "quality_defect");
      result.current.setValue("assigneeId", null);
      await result.current.handleSubmit(onValid, onInvalid)();
    });
    expect(onValid).toHaveBeenCalledTimes(1);
  });

  it("タイトル 200 文字超過でエラー", async () => {
    const { result } = renderHook(() => useEditIssueForm(true));
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await act(async () => {
      result.current.setValue("title", "a".repeat(201));
      result.current.setValue("category", "quality_defect");
      result.current.setValue("assigneeId", null);
      await result.current.handleSubmit(onValid, onInvalid)();
    });
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(onInvalid.mock.calls[0][0].title).toBeDefined();
    expect(onValid).not.toHaveBeenCalled();
  });
});
