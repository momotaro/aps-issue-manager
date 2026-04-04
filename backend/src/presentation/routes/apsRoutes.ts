import { Hono } from "hono";
import { getApsTokenUseCase } from "../../application/useCases/getApsTokenUseCase.js";
import { apsClient } from "../../compositionRoot.js";

const getApsToken = getApsTokenUseCase(apsClient);

const apsRoutes = new Hono().get("/token", async (c) => {
  try {
    const accessToken = await getApsToken();
    return c.json({ access_token: accessToken });
  } catch (error) {
    if (error instanceof Error && error.message === "APS is not configured") {
      return c.json({ error: "APS is not configured" }, 503);
    }
    console.error("Failed to get APS token");
    return c.json({ error: "Failed to get APS token" }, 500);
  }
});

export { apsRoutes };
