import type { InferRequestType, InferResponseType } from "hono/client";
import { apiClient } from "@/lib/api-client";
import type { IssueCategory, IssueStatus } from "@/types/issue";

// ---------------------------------------------------------------------------
// 履歴 API 型定義
// ---------------------------------------------------------------------------

type HistoryApi = (typeof apiClient.api.issues)[":id"]["history"];

/** GET /api/issues/:id/history のレスポンス要素（イベント1件）。AppType から導出。 */
export type IssueHistoryEvent = Extract<
  InferResponseType<HistoryApi["$get"]>,
  readonly unknown[]
>[number];

// ---------------------------------------------------------------------------
// 型定義（hono/rpc から導出）
// ---------------------------------------------------------------------------

type IssueApi = (typeof apiClient.api.issues)[":id"];

/** POST /api/issues の入力（body） */
type CreateIssueJson = InferRequestType<
  typeof apiClient.api.issues.$post
>["json"];
/** PUT /api/issues/:id の入力（body） */
type UpdateIssueJson = InferRequestType<IssueApi["$put"]>["json"];
/** POST /api/issues/:id/correct の入力（body） */
type CorrectIssueJson = InferRequestType<IssueApi["correct"]["$post"]>["json"];
/** POST /api/issues/:id/review の入力（body） */
type ReviewIssueJson = InferRequestType<IssueApi["review"]["$post"]>["json"];
/** POST /api/issues/:id/comments の入力（body） */
type AddCommentJson = InferRequestType<IssueApi["comments"]["$post"]>["json"];
/** POST /api/issues/:id/photos/upload-url の入力（body） */
type UploadUrlJson = InferRequestType<
  IssueApi["photos"]["upload-url"]["$post"]
>["json"];

/** GET /api/issues のレスポンス（成功時の配列要素）。 */
type IssueListResponseItem = Extract<
  InferResponseType<typeof apiClient.api.issues.$get>,
  readonly unknown[]
>[number];

/** GET /api/issues/:id のレスポンス（成功時）。 */
type IssueDetailResponse = Exclude<
  InferResponseType<IssueApi["$get"]>,
  { error: unknown }
>;

/** 指摘一覧の要素。AppType から導出。 */
export type IssueListItem = IssueListResponseItem;

/** 指摘詳細。`recentComments` を含む。AppType から導出。 */
export type IssueDetail = IssueDetailResponse;

/** Timeline に表示するコメント 1 件（`IssueDetail.recentComments[number]`）。 */
export type CommentItem = IssueDetail["recentComments"][number];

/** アップロード済みの pending 写真。コメント送信時に attachments として添付する。 */
export type PendingAttachment = {
  id: string;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
};

/** IssueForm から受け取る作成入力（comment を含む）。 */
export type CreateIssueInput = CreateIssueJson;

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

// TODO(auth): 認証導入時は backend セッションから actorId を取得する形に切り替え、
// クライアントから actorId を送信する箇所（createIssue 以外の引数 `actorId`）を廃止する。

type Client = typeof apiClient;

const defaultFetchOptions: RequestInit = {
  credentials: "omit",
};

export const createIssueRepository = (client: Client) => ({
  getIssues: async (filters?: {
    projectId?: string;
    status?: IssueStatus;
    category?: IssueCategory;
    assigneeId?: string;
    q?: string;
    sortBy?: "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  }): Promise<readonly IssueListItem[]> => {
    const res = await client.api.issues.$get(
      { query: filters ?? {} },
      { init: defaultFetchOptions },
    );
    if (!res.ok) throw new Error("Failed to fetch issues");
    const data = (await res.json()) as unknown;
    return data as readonly IssueListItem[];
  },

  getIssueDetail: async (id: string): Promise<IssueDetail> => {
    const res = await client.api.issues[":id"].$get(
      { param: { id } },
      { init: defaultFetchOptions },
    );
    if (!res.ok) throw new Error("Failed to fetch issue detail");
    const data = (await res.json()) as unknown;
    return data as IssueDetail;
  },

  createIssue: async (
    input: CreateIssueInput,
  ): Promise<{ issueId: string }> => {
    const res = await client.api.issues.$post(
      { json: input },
      { init: defaultFetchOptions },
    );
    if (!res.ok) throw new Error("Failed to create issue");
    const data = (await res.json()) as unknown;
    return data as { issueId: string };
  },

  updateIssue: async (
    id: string,
    input: Omit<UpdateIssueJson, "actorId">,
    actorId: string,
  ): Promise<{ ok: true }> => {
    const res = await client.api.issues[":id"].$put(
      {
        param: { id },
        json: { ...input, actorId } as UpdateIssueJson,
      },
      { init: defaultFetchOptions },
    );
    if (!res.ok) throw new Error("Failed to update issue");
    return (await res.json()) as { ok: true };
  },

  correctIssue: async (
    id: string,
    input: Omit<CorrectIssueJson, "actorId">,
    actorId: string,
  ): Promise<{ ok: true }> => {
    const res = await client.api.issues[":id"].correct.$post(
      {
        param: { id },
        json: { ...input, actorId } as CorrectIssueJson,
      },
      { init: defaultFetchOptions },
    );
    if (!res.ok) throw new Error("Failed to mark issue as corrected");
    return (await res.json()) as { ok: true };
  },

  reviewIssue: async (
    id: string,
    input: Omit<ReviewIssueJson, "actorId">,
    actorId: string,
  ): Promise<{ ok: true }> => {
    const res = await client.api.issues[":id"].review.$post(
      {
        param: { id },
        json: { ...input, actorId } as ReviewIssueJson,
      },
      { init: defaultFetchOptions },
    );
    if (!res.ok) throw new Error("Failed to review issue");
    return (await res.json()) as { ok: true };
  },

  addComment: async (
    id: string,
    input: Omit<AddCommentJson, "actorId">,
    actorId: string,
  ): Promise<{ ok: true }> => {
    const res = await client.api.issues[":id"].comments.$post(
      {
        param: { id },
        json: { ...input, actorId } as AddCommentJson,
      },
      { init: defaultFetchOptions },
    );
    if (!res.ok) throw new Error("Failed to add comment");
    return (await res.json()) as { ok: true };
  },

  getIssueHistory: async (
    id: string,
  ): Promise<readonly IssueHistoryEvent[]> => {
    const res = await client.api.issues[":id"].history.$get(
      { param: { id } },
      { init: defaultFetchOptions },
    );
    if (!res.ok) throw new Error("Failed to fetch issue history");
    const data = (await res.json()) as unknown;
    return data as readonly IssueHistoryEvent[];
  },

  generatePhotoUploadUrl: async (
    issueId: string,
    commentId: string,
    fileName: string,
  ): Promise<{ photoId: string; uploadUrl: string; storagePath: string }> => {
    const json: UploadUrlJson = { commentId, fileName };
    const res = await client.api.issues[":id"].photos["upload-url"].$post(
      {
        param: { id: issueId },
        json,
      },
      { init: defaultFetchOptions },
    );
    if (!res.ok) throw new Error("Failed to generate upload URL");
    return (await res.json()) as {
      photoId: string;
      uploadUrl: string;
      storagePath: string;
    };
  },
});

export const issueRepository = createIssueRepository(apiClient);
