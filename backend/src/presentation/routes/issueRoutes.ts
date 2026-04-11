import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { addCommentUseCase } from "../../application/useCases/addCommentUseCase.js";
import { correctIssueUseCase } from "../../application/useCases/correctIssueUseCase.js";
import { createIssueUseCase } from "../../application/useCases/createIssueUseCase.js";
import { deleteIssueUseCase } from "../../application/useCases/deleteIssueUseCase.js";
import { generatePhotoUploadUrlUseCase } from "../../application/useCases/generatePhotoUploadUrlUseCase.js";
import { getIssueDetailUseCase } from "../../application/useCases/getIssueDetailUseCase.js";
import { getIssueHistoryUseCase } from "../../application/useCases/getIssueHistoryUseCase.js";
import { getIssuesUseCase } from "../../application/useCases/getIssuesUseCase.js";
import { reviewIssueUseCase } from "../../application/useCases/reviewIssueUseCase.js";
import { updateIssueUseCase } from "../../application/useCases/updateIssueUseCase.js";
import {
  blobStorage,
  issueQueryService,
  issueRepository,
} from "../../compositionRoot.js";
import type {
  CommentId,
  IssueId,
  PhotoId,
  ProjectId,
  UserId,
} from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import type { Photo } from "../../domain/valueObjects/photo.js";
import { mapResultErrorToStatus } from "../middleware/errorHandler.js";
import {
  addCommentBodySchema,
  correctBodySchema,
  createIssueBodySchema,
  generateUploadUrlBodySchema,
  issueFiltersQuerySchema,
  reviewBodySchema,
  updateIssueBodySchema,
} from "../schemas/issueSchemas.js";
import { base62ToUuid, uuidToBase62 } from "../serializers/externalId.js";
import {
  serializeIssueDetail,
  serializeIssueEvent,
  serializeIssueListItem,
} from "../serializers/responseSerializers.js";

const createIssue = createIssueUseCase(issueRepository, blobStorage);
const getIssues = getIssuesUseCase(issueQueryService);
const getIssueDetail = getIssueDetailUseCase(issueQueryService);
const getIssueHistory = getIssueHistoryUseCase(issueQueryService);
const updateIssue = updateIssueUseCase(issueRepository);
const deleteIssue = deleteIssueUseCase(issueRepository, blobStorage);
const generateUploadUrl = generatePhotoUploadUrlUseCase(blobStorage);
const correctIssue = correctIssueUseCase(issueRepository, blobStorage);
const reviewIssue = reviewIssueUseCase(issueRepository);
const addComment = addCommentUseCase(issueRepository, blobStorage);

/** base62 の attachments をドメイン Photo に変換する。 */
const parseAttachments = (
  attachments?: Array<{
    id: string;
    fileName: string;
    storagePath: string;
    uploadedAt: string;
  }>,
): readonly Photo[] | undefined => {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map((a) => ({
    id: parseId<PhotoId>(base62ToUuid(a.id)),
    fileName: a.fileName,
    storagePath: a.storagePath,
    uploadedAt: new Date(a.uploadedAt),
  }));
};

export const issueRoutes = new Hono()
  .post("/", zValidator("json", createIssueBodySchema), async (c) => {
    const body = c.req.valid("json");
    const result = await createIssue({
      issueId: parseId<IssueId>(base62ToUuid(body.issueId)),
      projectId: parseId<ProjectId>(base62ToUuid(body.projectId)),
      title: body.title,
      category: body.category,
      position: body.position,
      reporterId: parseId<UserId>(base62ToUuid(body.reporterId)),
      assigneeId: body.assigneeId
        ? parseId<UserId>(base62ToUuid(body.assigneeId))
        : null,
      comment: {
        commentId: parseId<CommentId>(base62ToUuid(body.comment.commentId)),
        body: body.comment.body,
        attachments: parseAttachments(body.comment.attachments),
      },
    });
    if (!result.ok)
      return c.json(
        { error: result.error },
        mapResultErrorToStatus(result.error.code),
      );
    return c.json({ issueId: uuidToBase62(result.value.issueId) }, 201);
  })
  .get("/", zValidator("query", issueFiltersQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const filters = {
      ...(query.projectId && {
        projectId: parseId<ProjectId>(base62ToUuid(query.projectId)),
      }),
      ...(query.status && { status: query.status }),
      ...(query.category && { category: query.category }),
      ...(query.assigneeId && {
        assigneeId: parseId<UserId>(base62ToUuid(query.assigneeId)),
      }),
      ...(query.q && { keyword: query.q }),
    };
    const options = {
      ...(query.sortBy && { sortBy: query.sortBy }),
      ...(query.sortOrder && { sortOrder: query.sortOrder }),
    };
    const result = await getIssues(
      Object.keys(filters).length > 0 ? filters : undefined,
      Object.keys(options).length > 0 ? options : undefined,
    );
    if (!result.ok)
      return c.json(
        { error: result.error },
        mapResultErrorToStatus(result.error.code),
      );
    return c.json(result.value.map(serializeIssueListItem));
  })
  .get("/:id", async (c) => {
    const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
    const result = await getIssueDetail(issueId);
    if (!result.ok)
      return c.json(
        { error: result.error },
        mapResultErrorToStatus(result.error.code),
      );
    return c.json(serializeIssueDetail(result.value));
  })
  // --- 基本情報一括更新 ---
  .put("/:id", zValidator("json", updateIssueBodySchema), async (c) => {
    const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
    const body = c.req.valid("json");
    const result = await updateIssue({
      issueId,
      ...(body.title !== undefined && { title: body.title }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.assigneeId !== undefined && {
        assigneeId: body.assigneeId
          ? parseId<UserId>(base62ToUuid(body.assigneeId))
          : null,
      }),
      actorId: parseId<UserId>(base62ToUuid(body.actorId)),
    });
    if (!result.ok)
      return c.json(
        { error: result.error },
        mapResultErrorToStatus(result.error.code),
      );
    return c.json({ ok: true });
  })
  // --- ユースケース指向エンドポイント ---
  .post("/:id/correct", zValidator("json", correctBodySchema), async (c) => {
    const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
    const body = c.req.valid("json");
    const result = await correctIssue({
      issueId,
      status: body.status,
      actorId: parseId<UserId>(base62ToUuid(body.actorId)),
      comment: {
        commentId: parseId<CommentId>(base62ToUuid(body.comment.commentId)),
        body: body.comment.body,
        attachments: parseAttachments(body.comment.attachments),
      },
    });
    if (!result.ok)
      return c.json(
        { error: result.error },
        mapResultErrorToStatus(result.error.code),
      );
    return c.json({ ok: true });
  })
  .post("/:id/review", zValidator("json", reviewBodySchema), async (c) => {
    const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
    const body = c.req.valid("json");
    const result = await reviewIssue({
      issueId,
      status: body.status,
      actorId: parseId<UserId>(base62ToUuid(body.actorId)),
      comment: {
        commentId: parseId<CommentId>(base62ToUuid(body.comment.commentId)),
        body: body.comment.body,
      },
    });
    if (!result.ok)
      return c.json(
        { error: result.error },
        mapResultErrorToStatus(result.error.code),
      );
    return c.json({ ok: true });
  })
  .post(
    "/:id/comments",
    zValidator("json", addCommentBodySchema),
    async (c) => {
      const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
      const body = c.req.valid("json");
      const result = await addComment({
        issueId,
        actorId: parseId<UserId>(base62ToUuid(body.actorId)),
        comment: {
          commentId: parseId<CommentId>(base62ToUuid(body.comment.commentId)),
          body: body.comment.body,
          attachments: parseAttachments(body.comment.attachments),
        },
      });
      if (!result.ok)
        return c.json(
          { error: result.error },
          mapResultErrorToStatus(result.error.code),
        );
      return c.json({ ok: true }, 201);
    },
  )
  .delete("/:id", async (c) => {
    const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
    const result = await deleteIssue({ issueId });
    if (!result.ok)
      return c.json(
        { error: result.error },
        mapResultErrorToStatus(result.error.code),
      );
    return c.json({ ok: true });
  })
  .post(
    "/:id/photos/upload-url",
    zValidator("json", generateUploadUrlBodySchema),
    async (c) => {
      const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
      const body = c.req.valid("json");
      const result = await generateUploadUrl({
        issueId,
        commentId: parseId<CommentId>(base62ToUuid(body.commentId)),
        fileName: body.fileName,
      });
      if (!result.ok)
        return c.json(
          { error: result.error },
          mapResultErrorToStatus(result.error.code),
        );
      return c.json({
        photoId: uuidToBase62(result.value.photoId),
        uploadUrl: result.value.uploadUrl,
        storagePath: result.value.storagePath,
      });
    },
  )
  .get("/:id/history", async (c) => {
    const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
    const result = await getIssueHistory(issueId);
    if (!result.ok)
      return c.json(
        { error: result.error },
        mapResultErrorToStatus(result.error.code),
      );
    return c.json(result.value.map(serializeIssueEvent));
  });
