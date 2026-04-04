import { z } from "zod";

export const createProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10000),
  modelUrn: z.string().max(500),
});

export const updateProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  modelUrn: z.string().max(500).optional(),
});
