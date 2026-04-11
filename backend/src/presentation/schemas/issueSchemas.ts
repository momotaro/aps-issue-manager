import { z } from "zod";
import {
  COMMENT_MAX_ATTACHMENTS,
  COMMENT_MAX_LENGTH,
} from "../../domain/valueObjects/comment.js";
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

const attachmentSchema = z.object({
  id: base62IdSchema,
  fileName: safeFileNameSchema,
  storagePath: z
    .string()
    .min(1)
    .max(500)
    .startsWith("pending/")
    .refine((v) => !v.includes(".."), {
      message: "storagePath must not contain '..'",
    }),
  uploadedAt: z.iso.datetime(),
});

const commentBodySchema = z.string().trim().min(1).max(COMMENT_MAX_LENGTH);

export const createIssueBodySchema = z.object({
  issueId: base62IdSchema,
  projectId: base62IdSchema,
  title: z.string().trim().min(1).max(200),
  category: z.enum(ISSUE_CATEGORIES),
  position: positionSchema,
  reporterId: base62IdSchema,
  assigneeId: base62IdSchema.nullable().optional(),
  comment: z.object({
    commentId: base62IdSchema,
    body: commentBodySchema,
    attachments: z
      .array(attachmentSchema)
      .max(COMMENT_MAX_ATTACHMENTS)
      .optional(),
  }),
});

export const issueFiltersQuerySchema = z.object({
  projectId: base62IdSchema.optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  category: z.enum(ISSUE_CATEGORIES).optional(),
  assigneeId: base62IdSchema.optional(),
  q: z.string().trim().max(200).optional(),
  sortBy: z.enum(["createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const updateIssueBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.enum(ISSUE_CATEGORIES).optional(),
  assigneeId: base62IdSchema.nullable().optional(),
  actorId: base62IdSchema,
});

export const correctBodySchema = z.object({
  status: z.enum(ISSUE_STATUSES).optional(),
  actorId: base62IdSchema,
  comment: z.object({
    commentId: base62IdSchema,
    body: commentBodySchema,
    attachments: z
      .array(attachmentSchema)
      .max(COMMENT_MAX_ATTACHMENTS)
      .optional(),
  }),
});

export const reviewBodySchema = z.object({
  status: z.enum(ISSUE_STATUSES).optional(),
  actorId: base62IdSchema,
  comment: z.object({
    commentId: base62IdSchema,
    body: commentBodySchema,
  }),
});

export const addCommentBodySchema = z.object({
  actorId: base62IdSchema,
  comment: z.object({
    commentId: base62IdSchema,
    body: commentBodySchema,
    attachments: z
      .array(attachmentSchema)
      .max(COMMENT_MAX_ATTACHMENTS)
      .optional(),
  }),
});

export const generateUploadUrlBodySchema = z.object({
  commentId: base62IdSchema,
  fileName: safeFileNameSchema,
});
