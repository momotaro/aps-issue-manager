import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { userRepository } from "../../compositionRoot.js";
import { createUser, updateUser } from "../../domain/entities/user.js";
import type { UserId } from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import {
  createUserBodySchema,
  updateUserBodySchema,
} from "../schemas/userSchemas.js";
import { base62ToUuid } from "../serializers/externalId.js";
import { serializeUser } from "../serializers/responseSerializers.js";

export const userRoutes = new Hono()
  .post("/", zValidator("json", createUserBodySchema), async (c) => {
    const body = c.req.valid("json");
    const user = createUser(body);
    await userRepository.save(user);
    return c.json(serializeUser(user), 201);
  })
  .get("/", async (c) => {
    const users = await userRepository.findAll();
    return c.json(users.map(serializeUser));
  })
  .get("/:id", async (c) => {
    const uuid = base62ToUuid(c.req.param("id"));
    const user = await userRepository.findById(parseId<UserId>(uuid));
    if (!user)
      return c.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        404,
      );
    return c.json(serializeUser(user));
  })
  .put("/:id", zValidator("json", updateUserBodySchema), async (c) => {
    const uuid = base62ToUuid(c.req.param("id"));
    const user = await userRepository.findById(parseId<UserId>(uuid));
    if (!user)
      return c.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        404,
      );
    const body = c.req.valid("json");
    const updated = updateUser(user, body);
    await userRepository.save(updated);
    return c.json(serializeUser(updated));
  });
