import type { Project } from "../../domain/entities/project.js";
import type { User } from "../../domain/entities/user.js";
import type { IssueDomainEvent } from "../../domain/events/issueEvents.js";
import type {
  IssueDetail,
  IssueListItem,
} from "../../domain/repositories/issueQueryService.js";
import { uuidToBase62 } from "./externalId.js";

export const serializeUser = (user: User) => ({
  id: uuidToBase62(user.id),
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

export const serializeProject = (project: Project) => ({
  id: uuidToBase62(project.id),
  name: project.name,
  description: project.description,
  modelUrn: project.modelUrn,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString(),
});

export const serializeIssueListItem = (item: IssueListItem) => ({
  id: uuidToBase62(item.id),
  projectId: uuidToBase62(item.projectId),
  title: item.title,
  status: item.status,
  category: item.category,
  reporterName: item.reporterName,
  assigneeName: item.assigneeName,
  position: item.position,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

export const serializeIssueDetail = (detail: IssueDetail) => ({
  ...serializeIssueListItem(detail),
  recentComments: detail.recentComments.map((c) => ({
    commentId: uuidToBase62(c.commentId),
    body: c.body,
    actorId: uuidToBase62(c.actorId),
    attachments: c.attachments.map((p) => ({
      id: uuidToBase62(p.id),
      fileName: p.fileName,
      uploadedAt: p.uploadedAt.toISOString(),
    })),
    createdAt: c.createdAt.toISOString(),
  })),
});

const isIdKey = (key: string) => key === "id" || key.endsWith("Id");

const serializePayloadValue = (
  key: string | undefined,
  value: unknown,
): unknown => {
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value))
    return value.map((item) => serializePayloadValue(undefined, item));

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([k, v]) => {
        if (k === "storagePath") return [];
        return [[k, serializePayloadValue(k, v)]];
      }),
    );
  }

  if (key && isIdKey(key) && typeof value === "string") {
    return uuidToBase62(value);
  }

  return value;
};

export const serializeIssueEvent = (event: IssueDomainEvent) => ({
  id: uuidToBase62(event.id),
  issueId: uuidToBase62(event.issueId),
  type: event.type,
  payload: serializePayloadValue(undefined, event.payload),
  actorId: uuidToBase62(event.actorId),
  version: event.version,
  occurredAt: event.occurredAt.toISOString(),
});
