export const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
} as const;

export function withPrivateNoStoreHeaders(init?: ResponseInit): ResponseInit {
  return {
    ...init,
    headers: {
      ...PRIVATE_NO_STORE_HEADERS,
      ...(init?.headers ?? {}),
    },
  };
}
