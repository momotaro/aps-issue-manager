import { z } from "zod";
import { USER_ROLES } from "../../domain/entities/user.js";

export const createUserBodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
});

export const updateUserBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(USER_ROLES).optional(),
});
