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

// mock ユーザーを users テーブルに冪等に投入（認証導入 Issue で削除予定）
// production では実行しない（本番環境に固定 UUID の admin/member を注入しないため）
if (process.env.NODE_ENV !== "production") {
  seedMockUsers(db)
    .then(() => console.log("Mock users seeded"))
    .catch((err) => console.error("Failed to seed mock users:", err));
}

serve({ fetch: app.fetch, port: 4000 }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});

export default app;
export type AppType = typeof api;
