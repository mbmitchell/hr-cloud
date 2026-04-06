type GraphClientConfig = {
  graphTenantId: string;
  graphClientId: string;
  graphClientSecret: string;
  graphMailboxUserId: string;
};

type CachedGraphToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedGraphToken | null = null;

export function hasRequiredGraphConfig(config: GraphClientConfig) {
  return Boolean(
    config.graphTenantId &&
      config.graphClientId &&
      config.graphClientSecret &&
      config.graphMailboxUserId
  );
}

export async function getGraphAccessToken(config: GraphClientConfig) {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${config.graphTenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: config.graphClientId,
    client_secret: config.graphClientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Graph token request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : null;
  const expiresIn =
    typeof payload.expires_in === "number" ? payload.expires_in : 3600;

  if (!accessToken) {
    throw new Error("Graph token response did not include an access token.");
  }

  cachedToken = {
    accessToken,
    expiresAt: now + expiresIn * 1000,
  };

  return accessToken;
}

export async function graphApiRequest(
  config: GraphClientConfig,
  path: string,
  init: {
    method: string;
    body?: string;
    headers?: Record<string, string>;
  }
) {
  const accessToken = await getGraphAccessToken(config);

  return fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    body: init.body,
  });
}
