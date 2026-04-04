import { z } from "zod";
import { ISSUE_CATEGORIES } from "../../domain/valueObjects/issueCategory.js";
import { ISSUE_STATUSES } from "../../domain/valueObjects/issueStatus.js";
import { base62IdSchema, positionSchema } from "./commonSchemas.js";

const safeFileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((v) => !v.includes("/") && !v.includes("\\") && !v.includes(".."), {
    message: "File name must not contain path separators or '..'",
  });

export const createIssueBodySchema = z.object({
  projectId: base62IdSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000),
  category: z.enum(ISSUE_CATEGORIES),
  position: positionSchema,
  reporterId: base62IdSchema,
  assigneeId: base62IdSchema.nullable().optional(),
});

export const issueFiltersQuerySchema = z.object({
  projectId: base62IdSchema.optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  category: z.enum(ISSUE_CATEGORIES).optional(),
  assigneeId: base62IdSchema.optional(),
});

export const updateTitleBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  actorId: base62IdSchema,
});

export const updateDescriptionBodySchema = z.object({
  description: z.string().max(10000),
  actorId: base62IdSchema,
});

export const updateCategoryBodySchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  actorId: base62IdSchema,
});

export const updateAssigneeBodySchema = z.object({
  assigneeId: base62IdSchema.nullable(),
  actorId: base62IdSchema,
});

export const changeStatusBodySchema = z.object({
  status: z.enum(ISSUE_STATUSES),
  actorId: base62IdSchema,
});

export const generateUploadUrlBodySchema = z.object({
  fileName: safeFileNameSchema,
  phase: z.enum(["before", "after"]),
});

export const confirmPhotoBodySchema = z.object({
  photoId: base62IdSchema,
  fileName: safeFileNameSchema,
  phase: z.enum(["before", "after"]),
  actorId: base62IdSchema,
});

export const removePhotoBodySchema = z.object({
  actorId: base62IdSchema,
});
