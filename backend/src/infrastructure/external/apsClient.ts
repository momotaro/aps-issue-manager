interface ApsToken {
  access_token: string;
  expires_in: number;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

export interface ApsClient {
  getAccessToken: () => Promise<string>;
}

export const createApsClient = (
  clientId: string,
  clientSecret: string,
): ApsClient => {
  let cachedToken: CachedToken | null = null;
  let inFlightRequest: Promise<string> | null = null;

  const getAccessToken = async (): Promise<string> => {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
      return cachedToken.token;
    }

    if (inFlightRequest) {
      return inFlightRequest;
    }

    inFlightRequest = (async () => {
      try {
        const response = await fetch(
          "https://developer.api.autodesk.com/authentication/v2/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "client_credentials",
              client_id: clientId,
              client_secret: clientSecret,
              scope: "data:read viewables:read",
            }),
          },
        );

        if (!response.ok) {
          throw new Error(`APS auth failed: ${response.status}`);
        }

        const data = (await response.json()) as ApsToken;

        cachedToken = {
          token: data.access_token,
          expiresAt: Date.now() + (data.expires_in - 60) * 1000,
        };

        return data.access_token;
      } finally {
        inFlightRequest = null;
      }
    })();

    return inFlightRequest;
  };

  return { getAccessToken };
};
