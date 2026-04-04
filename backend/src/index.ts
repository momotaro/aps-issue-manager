import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "./presentation/middleware/errorHandler.js";
import { issueRoutes } from "./presentation/routes/issueRoutes.js";
import { projectRoutes } from "./presentation/routes/projectRoutes.js";
import { userRoutes } from "./presentation/routes/userRoutes.js";

const app = new Hono();

app.use("*", cors({ origin: "http://localhost:3000" }));
app.onError(errorHandler);

app.get("/health", (c) => c.json({ status: "ok" }));

const api = app
  .route("/api/issues", issueRoutes)
  .route("/api/users", userRoutes)
  .route("/api/projects", projectRoutes);

serve({ fetch: app.fetch, port: 4000 }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});

export default app;
export type AppType = typeof api;
