import { hc } from "hono/client";
import type { AppType } from "../../../backend/src/index.js";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const apiClient = hc<AppType>(baseUrl);

export type { AppType };
