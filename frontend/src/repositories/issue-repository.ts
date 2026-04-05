import type { hc } from "hono/client";
import type { IssueCategory, IssueStatus } from "@/app/viewer/types";
import { type AppType, apiClient } from "@/lib/api-client";

type Client = ReturnType<typeof hc<AppType>>;

export type PhotoPhase = "before" | "after";

export type PhotoItem = {
  id: string;
  fileName: string;
  storagePath: string;
  phase: PhotoPhase;
  uploadedAt: string;
};

export type IssueListItem = {
  id: string;
  projectId: string;
  title: string;
  status: IssueStatus;
  category: IssueCategory;
  reporterName: string | null;
  assigneeName: string | null;
  position:
    | { type: "spatial"; worldPosition: { x: number; y: number; z: number } }
    | {
        type: "component";
        dbId: number;
        worldPosition: { x: number; y: number; z: number };
      };
  photoCount: number;
  createdAt: string;
  updatedAt: string;
};

export type IssueDetail = IssueListItem & {
  description: string;
  photos: PhotoItem[];
};

export type CreateIssueInput = {
  issueId: string;
  projectId: string;
  title: string;
  description: string;
  category: IssueCategory;
  position:
    | { type: "spatial"; worldPosition: { x: number; y: number; z: number } }
    | {
        type: "component";
        dbId: number;
        worldPosition: { x: number; y: number; z: number };
      };
  reporterId: string;
  assigneeId?: string | null;
};

export const createIssueRepository = (client: Client) => ({
  getIssues: async (filters?: {
    projectId?: string;
    status?: IssueStatus;
    category?: IssueCategory;
    assigneeId?: string;
  }): Promise<IssueListItem[]> => {
    const res = await client.api.issues.$get({
      query: filters ?? {},
    });
    if (!res.ok) throw new Error("Failed to fetch issues");
    return (await res.json()) as IssueListItem[];
  },

  getIssueDetail: async (id: string): Promise<IssueDetail> => {
    const res = await client.api.issues[":id"].$get({
      param: { id },
    });
    if (!res.ok) throw new Error("Failed to fetch issue detail");
    return (await res.json()) as IssueDetail;
  },

  createIssue: async (
    input: CreateIssueInput,
  ): Promise<{ issueId: string }> => {
    const res = await client.api.issues.$post({
      json: input,
    });
    if (!res.ok) throw new Error("Failed to create issue");
    return (await res.json()) as { issueId: string };
  },

  changeIssueStatus: async (
    id: string,
    status: IssueStatus,
    actorId: string,
  ): Promise<{ ok: true }> => {
    const res = await client.api.issues[":id"].status.$post({
      param: { id },
      json: { status, actorId },
    });
    if (!res.ok) throw new Error("Failed to change issue status");
    return (await res.json()) as { ok: true };
  },

  generatePhotoUploadUrl: async (
    issueId: string,
    fileName: string,
    phase: PhotoPhase,
  ): Promise<{ photoId: string; uploadUrl: string }> => {
    const res = await client.api.issues[":id"].photos["upload-url"].$post({
      param: { id: issueId },
      json: { fileName, phase },
    });
    if (!res.ok) throw new Error("Failed to generate upload URL");
    return (await res.json()) as { photoId: string; uploadUrl: string };
  },

  confirmPhotoUpload: async (
    issueId: string,
    photoId: string,
    fileName: string,
    phase: PhotoPhase,
    actorId: string,
  ): Promise<{ ok: true }> => {
    const res = await client.api.issues[":id"].photos.confirm.$post({
      param: { id: issueId },
      json: { photoId, fileName, phase, actorId },
    });
    if (!res.ok) throw new Error("Failed to confirm photo upload");
    return (await res.json()) as { ok: true };
  },

  removePhoto: async (
    issueId: string,
    photoId: string,
    actorId: string,
  ): Promise<{ ok: true }> => {
    const res = await client.api.issues[":id"].photos[":photoId"].$delete({
      param: { id: issueId, photoId },
      json: { actorId },
    });
    if (!res.ok) throw new Error("Failed to remove photo");
    return (await res.json()) as { ok: true };
  },
});

export const issueRepository = createIssueRepository(apiClient);
