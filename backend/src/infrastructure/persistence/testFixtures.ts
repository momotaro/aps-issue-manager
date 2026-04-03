import type { Project } from "../../domain/entities/project.js";
import { createProject } from "../../domain/entities/project.js";
import type { User } from "../../domain/entities/user.js";
import { createUser } from "../../domain/entities/user.js";
import { createEventMeta } from "../../domain/events/eventMeta.js";
import type {
  IssueCreatedEvent,
  IssueDomainEvent,
} from "../../domain/events/issueEvents.js";
import {
  generateId,
  type IssueId,
  type ProjectId,
  parseId,
  type UserId,
} from "../../domain/valueObjects/brandedId.js";
import type { IssueCategory } from "../../domain/valueObjects/issueCategory.js";
import type { IssueStatus } from "../../domain/valueObjects/issueStatus.js";
import { createSpatialPosition } from "../../domain/valueObjects/position.js";

export const testActorId = parseId<UserId>(
  "019577a0-0000-7000-8000-000000000001",
);
export const testReporterId = parseId<UserId>(
  "019577a0-0000-7000-8000-000000000002",
);
export const testProjectId = parseId<ProjectId>(
  "019577a0-0000-7000-8000-000000000010",
);

export const makeIssueCreatedEvent = (
  overrides?: Partial<{
    issueId: IssueId;
    projectId: ProjectId;
    reporterId: UserId;
    actorId: UserId;
    category: IssueCategory;
    title: string;
  }>,
): IssueCreatedEvent => {
  const issueId = overrides?.issueId ?? generateId<IssueId>();
  const actorId = overrides?.actorId ?? testActorId;
  const meta = createEventMeta(issueId, actorId, 1);

  return Object.freeze({
    ...meta,
    type: "IssueCreated" as const,
    payload: Object.freeze({
      projectId: overrides?.projectId ?? testProjectId,
      title: overrides?.title ?? "テスト指摘",
      description: "テスト用の指摘です",
      status: "open" as const,
      category: overrides?.category ?? ("quality_defect" as const),
      position: createSpatialPosition(1, 2, 3),
      reporterId: overrides?.reporterId ?? testReporterId,
      assigneeId: null,
      photos: Object.freeze([]),
    }),
  });
};

export const makeTitleUpdatedEvent = (
  issueId: IssueId,
  version: number,
  title: string,
): IssueDomainEvent =>
  Object.freeze({
    ...createEventMeta(issueId, testActorId, version),
    type: "IssueTitleUpdated" as const,
    payload: Object.freeze({ title }),
  });

export const makeStatusChangedEvent = (
  issueId: IssueId,
  version: number,
  from: IssueStatus,
  to: IssueStatus,
): IssueDomainEvent =>
  Object.freeze({
    ...createEventMeta(issueId, testActorId, version),
    type: "IssueStatusChanged" as const,
    payload: Object.freeze({ from, to }),
  });

export const makeTestUser = (
  overrides?: Partial<{ name: string; email: string }>,
): User =>
  createUser({
    name: overrides?.name ?? "テストユーザー",
    email: overrides?.email ?? `test-${Date.now()}@example.com`,
    role: "member",
  });

export const makeTestProject = (): Project =>
  createProject({
    name: "テストプロジェクト",
    description: "テスト用プロジェクト",
    modelUrn: "urn:adsk.objects:test-model",
  });
