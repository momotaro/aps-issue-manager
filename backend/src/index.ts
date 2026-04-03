import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

serve({ fetch: app.fetch, port: 4000 }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});

export default app;
export type AppType = typeof app;
