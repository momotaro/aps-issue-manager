import type { hc } from "hono/client";
import type { IssueCategory, IssueStatus } from "@/app/viewer/types";
import { type AppType, apiClient } from "@/lib/api-client";

type Client = ReturnType<typeof hc<AppType>>;

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

export type CreateIssueInput = {
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
});

export const issueRepository = createIssueRepository(apiClient);
