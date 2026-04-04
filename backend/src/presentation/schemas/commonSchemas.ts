import { z } from "zod";

export const base62IdSchema = z.string().regex(/^[0-9A-Za-z]{22}$/);

const worldPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const positionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("spatial"),
    worldPosition: worldPositionSchema,
  }),
  z.object({
    type: z.literal("component"),
    dbId: z.number().int(),
    worldPosition: worldPositionSchema,
  }),
]);
