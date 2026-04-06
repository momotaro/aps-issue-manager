import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { changeIssueStatusUseCase } from "../../application/useCases/changeIssueStatusUseCase.js";
import { confirmPhotoUploadUseCase } from "../../application/useCases/confirmPhotoUploadUseCase.js";
import { createIssueUseCase } from "../../application/useCases/createIssueUseCase.js";
import { deleteIssueUseCase } from "../../application/useCases/deleteIssueUseCase.js";
import { generatePhotoUploadUrlUseCase } from "../../application/useCases/generatePhotoUploadUrlUseCase.js";
import { getIssueDetailUseCase } from "../../application/useCases/getIssueDetailUseCase.js";
import { getIssueHistoryUseCase } from "../../application/useCases/getIssueHistoryUseCase.js";
import { getIssuesUseCase } from "../../application/useCases/getIssuesUseCase.js";
import { removePhotoUseCase } from "../../application/useCases/removePhotoUseCase.js";
import { updateIssueUseCase } from "../../application/useCases/updateIssueUseCase.js";
import {
  blobStorage,
  issueQueryService,
  issueRepository,
} from "../../compositionRoot.js";
import type {
  IssueId,
  PhotoId,
  ProjectId,
  UserId,
} from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import { mapResultErrorToStatus } from "../middleware/errorHandler.js";
import {
  changeStatusBodySchema,
  confirmPhotoBodySchema,
  createIssueBodySchema,
  generateUploadUrlBodySchema,
  issueFiltersQuerySchema,
  removePhotoBodySchema,
  updateAssigneeBodySchema,
  updateCategoryBodySchema,
  updateDescriptionBodySchema,
  updateTitleBodySchema,
} from "../schemas/issueSchemas.js";
import { base62ToUuid, uuidToBase62 } from "../serializers/externalId.js";
import {
  serializeIssueDetail,
  serializeIssueEvent,
  serializeIssueListItem,
} from "../serializers/responseSerializers.js";

const createIssue = createIssueUseCase(issueRepository);
const getIssues = getIssuesUseCase(issueQueryService);
const getIssueDetail = getIssueDetailUseCase(issueQueryService);
const getIssueHistory = getIssueHistoryUseCase(issueQueryService);
const updateIssue = updateIssueUseCase(issueRepository);
const changeStatus = changeIssueStatusUseCase(issueRepository);
const deleteIssue = deleteIssueUseCase(issueRepository, blobStorage);
const generateUploadUrl = generatePhotoUploadUrlUseCase(blobStorage);
const confirmPhoto = confirmPhotoUploadUseCase(issueRepository, blobStorage);
const removePhoto = removePhotoUseCase(issueRepository, blobStorage);

export const issueRoutes = new Hono()
  .post("/", zValidator("json", createIssueBodySchema), async (c) => {
    const body = c.req.valid("json");
    const result = await createIssue({
      issueId: parseId<IssueId>(base62ToUuid(body.issueId)),
      projectId: parseId<ProjectId>(base62ToUuid(body.projectId)),
      title: body.title,
      description: body.description,
      category: body.category,
      position: body.position,
      reporterId: parseId<UserId>(base62ToUuid(body.reporterId)),
      assigneeId: body.assigneeId
        ? parseId<UserId>(base62ToUuid(body.assigneeId))
        : null,
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
  .put("/:id/title", zValidator("json", updateTitleBodySchema), async (c) => {
    const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
    const body = c.req.valid("json");
    const result = await updateIssue({
      issueId,
      title: body.title,
      actorId: parseId<UserId>(base62ToUuid(body.actorId)),
    });
    if (!result.ok)
      return c.json(
        { error: result.error },
        mapResultErrorToStatus(result.error.code),
      );
    return c.json({ ok: true });
  })
  .put(
    "/:id/description",
    zValidator("json", updateDescriptionBodySchema),
    async (c) => {
      const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
      const body = c.req.valid("json");
      const result = await updateIssue({
        issueId,
        description: body.description,
        actorId: parseId<UserId>(base62ToUuid(body.actorId)),
      });
      if (!result.ok)
        return c.json(
          { error: result.error },
          mapResultErrorToStatus(result.error.code),
        );
      return c.json({ ok: true });
    },
  )
  .put(
    "/:id/category",
    zValidator("json", updateCategoryBodySchema),
    async (c) => {
      const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
      const body = c.req.valid("json");
      const result = await updateIssue({
        issueId,
        category: body.category,
        actorId: parseId<UserId>(base62ToUuid(body.actorId)),
      });
      if (!result.ok)
        return c.json(
          { error: result.error },
          mapResultErrorToStatus(result.error.code),
        );
      return c.json({ ok: true });
    },
  )
  .put(
    "/:id/assignee",
    zValidator("json", updateAssigneeBodySchema),
    async (c) => {
      const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
      const body = c.req.valid("json");
      const result = await updateIssue({
        issueId,
        assigneeId: body.assigneeId
          ? parseId<UserId>(base62ToUuid(body.assigneeId))
          : null,
        actorId: parseId<UserId>(base62ToUuid(body.actorId)),
      });
      if (!result.ok)
        return c.json(
          { error: result.error },
          mapResultErrorToStatus(result.error.code),
        );
      return c.json({ ok: true });
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
    "/:id/status",
    zValidator("json", changeStatusBodySchema),
    async (c) => {
      const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
      const body = c.req.valid("json");
      const result = await changeStatus({
        issueId,
        newStatus: body.status,
        actorId: parseId<UserId>(base62ToUuid(body.actorId)),
      });
      if (!result.ok)
        return c.json(
          { error: result.error },
          mapResultErrorToStatus(result.error.code),
        );
      return c.json({ ok: true });
    },
  )
  .post(
    "/:id/photos/upload-url",
    zValidator("json", generateUploadUrlBodySchema),
    async (c) => {
      const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
      const body = c.req.valid("json");
      const result = await generateUploadUrl({
        issueId,
        fileName: body.fileName,
        phase: body.phase,
      });
      if (!result.ok)
        return c.json(
          { error: result.error },
          mapResultErrorToStatus(result.error.code),
        );
      return c.json({
        photoId: uuidToBase62(result.value.photoId),
        uploadUrl: result.value.uploadUrl,
      });
    },
  )
  .post(
    "/:id/photos/confirm",
    zValidator("json", confirmPhotoBodySchema),
    async (c) => {
      const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
      const body = c.req.valid("json");
      const result = await confirmPhoto({
        issueId,
        photoId: parseId<PhotoId>(base62ToUuid(body.photoId)),
        fileName: body.fileName,
        phase: body.phase,
        actorId: parseId<UserId>(base62ToUuid(body.actorId)),
      });
      if (!result.ok)
        return c.json(
          { error: result.error },
          mapResultErrorToStatus(result.error.code),
        );
      return c.json({ ok: true }, 201);
    },
  )
  .delete(
    "/:id/photos/:photoId",
    zValidator("json", removePhotoBodySchema),
    async (c) => {
      const issueId = parseId<IssueId>(base62ToUuid(c.req.param("id")));
      const photoId = parseId<PhotoId>(base62ToUuid(c.req.param("photoId")));
      const body = c.req.valid("json");
      const result = await removePhoto({
        issueId,
        photoId,
        actorId: parseId<UserId>(base62ToUuid(body.actorId)),
      });
      if (!result.ok)
        return c.json(
          { error: result.error },
          mapResultErrorToStatus(result.error.code),
        );
      return c.json({ ok: true });
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
