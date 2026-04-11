/** biome-ignore-all lint/suspicious/noExplicitAny: test doubles */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the repository before importing hooks
vi.mock("@/repositories/issue-repository", () => ({
  issueRepository: {
    updateIssue: vi.fn(),
    correctIssue: vi.fn(),
    reviewIssue: vi.fn(),
    addComment: vi.fn(),
    createIssue: vi.fn(),
    getIssues: vi.fn(),
    getIssueDetail: vi.fn(),
    getIssueHistory: vi.fn(),
  },
}));

const { issueRepository } = await import("@/repositories/issue-repository");
const hooks = await import("./issues-state.hooks");

const makeWrapper = (client: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe("issues-state.hooks mutation invalidation", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("useUpdateIssue: 成功時に ['issues'] と ['issue-detail', id] を invalidate する", async () => {
    (issueRepository.updateIssue as any).mockResolvedValue({ ok: true });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => hooks.useUpdateIssue(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: "issue1",
        input: { title: "new" },
        actorId: "actor1",
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["issues"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["issue-detail", "issue1"],
      });
    });
    expect(issueRepository.updateIssue).toHaveBeenCalledWith(
      "issue1",
      { title: "new" },
      "actor1",
    );
  });

  it("useCorrectIssue: 成功時に invalidate + repository に正しい引数が渡る", async () => {
    (issueRepository.correctIssue as any).mockResolvedValue({ ok: true });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => hooks.useCorrectIssue(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: "issue1",
        input: {
          status: "in_review",
          comment: { commentId: "c1", body: "done" },
        },
        actorId: "actor1",
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["issues"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["issue-detail", "issue1"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["issue-history", "issue1"],
      });
    });
  });

  it("useReviewIssue: approve / reject 両方で同じ invalidate が走る", async () => {
    (issueRepository.reviewIssue as any).mockResolvedValue({ ok: true });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => hooks.useReviewIssue(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: "issue1",
        input: {
          status: "done",
          comment: { commentId: "c1", body: "approved" },
        },
        actorId: "actor1",
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["issues"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["issue-history", "issue1"],
      });
    });
  });

  it("useAddComment: 成功時に invalidate + actorId が mutation 引数に含まれる", async () => {
    (issueRepository.addComment as any).mockResolvedValue({ ok: true });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => hooks.useAddComment(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: "issue1",
        input: { comment: { commentId: "c1", body: "hi" } },
        actorId: "actor1",
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["issues"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["issue-history", "issue1"],
      });
    });
    expect(issueRepository.addComment).toHaveBeenCalledWith(
      "issue1",
      { comment: { commentId: "c1", body: "hi" } },
      "actor1",
    );
  });

  it("mutation が失敗したら throw されて invalidate は呼ばれない", async () => {
    (issueRepository.updateIssue as any).mockRejectedValue(new Error("fail"));
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => hooks.useUpdateIssue(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: "issue1",
          input: { title: "new" },
          actorId: "actor1",
        }),
      ).rejects.toThrow("fail");
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
