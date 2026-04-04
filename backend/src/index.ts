import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "./presentation/middleware/errorHandler.js";
import { issueRoutes } from "./presentation/routes/issueRoutes.js";
import { projectRoutes } from "./presentation/routes/projectRoutes.js";
import { userRoutes } from "./presentation/routes/userRoutes.js";

const app = new Hono();

const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "";
      return allowedOrigins.includes(origin) ? origin : "";
    },
  }),
);
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
