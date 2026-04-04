import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { projectRepository } from "../../compositionRoot.js";
import { createProject, updateProject } from "../../domain/entities/project.js";
import type { ProjectId } from "../../domain/valueObjects/brandedId.js";
import { parseId } from "../../domain/valueObjects/brandedId.js";
import {
  createProjectBodySchema,
  updateProjectBodySchema,
} from "../schemas/projectSchemas.js";
import { base62ToUuid } from "../serializers/externalId.js";
import { serializeProject } from "../serializers/responseSerializers.js";

export const projectRoutes = new Hono()
  .post("/", zValidator("json", createProjectBodySchema), async (c) => {
    const body = c.req.valid("json");
    const project = createProject(body);
    await projectRepository.save(project);
    return c.json(serializeProject(project), 201);
  })
  .get("/", async (c) => {
    const projects = await projectRepository.findAll();
    return c.json(projects.map(serializeProject));
  })
  .get("/:id", async (c) => {
    const uuid = base62ToUuid(c.req.param("id"));
    const project = await projectRepository.findById(parseId<ProjectId>(uuid));
    if (!project) return c.json({ error: "Project not found" }, 404);
    return c.json(serializeProject(project));
  })
  .put("/:id", zValidator("json", updateProjectBodySchema), async (c) => {
    const uuid = base62ToUuid(c.req.param("id"));
    const project = await projectRepository.findById(parseId<ProjectId>(uuid));
    if (!project) return c.json({ error: "Project not found" }, 404);
    const body = c.req.valid("json");
    const updated = updateProject(project, body);
    await projectRepository.save(updated);
    return c.json(serializeProject(updated));
  });
