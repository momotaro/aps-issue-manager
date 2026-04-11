import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { db } from "./infrastructure/adapter/postgresql.js";
import { seedMockUsers } from "./infrastructure/persistence/seedMockUsers.js";
import { errorHandler } from "./presentation/middleware/errorHandler.js";
import { apsRoutes } from "./presentation/routes/apsRoutes.js";
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
      if (!origin) return undefined;
      return allowedOrigins.includes(origin) ? origin : undefined;
    },
  }),
);
app.onError(errorHandler);

app.get("/health", (c) => c.json({ status: "ok" }));

const api = app
  .route("/api/aps", apsRoutes)
  .route("/api/issues", issueRoutes)
  .route("/api/users", userRoutes)
  .route("/api/projects", projectRoutes);

// mock ユーザー seed（非 production のみ）を完了してからサーバを起動する。
// fire-and-forget だと起動直後のリクエストが seed 完了前に走り得るため、
// 明示的に await してレースを避ける。
async function bootstrap(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    await seedMockUsers(db);
    console.log("Mock users seeded");
  }

  serve({ fetch: app.fetch, port: 4000 }, (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
export type AppType = typeof api;
