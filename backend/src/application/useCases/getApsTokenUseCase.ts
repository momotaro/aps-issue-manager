import type { ApsClient } from "../../infrastructure/external/apsClient.js";

export const getApsTokenUseCase =
  (apsClient: ApsClient | null) => async (): Promise<string> => {
    if (!apsClient) {
      throw new Error("APS is not configured");
    }
    return apsClient.getAccessToken();
  };
