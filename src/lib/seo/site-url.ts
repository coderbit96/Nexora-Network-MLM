const DEVELOPMENT_FALLBACK_URL = "http://localhost:3000";

/**
 * Returns the canonical public origin used by metadata routes and social tags.
 * Deployment preflight rejects the development fallback in production.
 */
export function getSiteUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? DEVELOPMENT_FALLBACK_URL);
  } catch {
    return new URL(DEVELOPMENT_FALLBACK_URL);
  }
}

export function getAbsoluteUrl(path = "/"): string {
  return new URL(path, getSiteUrl()).toString();
}
