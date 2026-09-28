const SENSITIVE_KEY = /password|token|secret|private.?key|credential|authorization|cookie|account.?number|ifsc|bank|card|cvv|payment.?detail/i;
const SAFE_BANKING_KEY = /accountlast4/i;
const MAX_DEPTH = 6;
const MAX_STRING = 1_000;

export type AuditRequestContext = { ipAddress?: string; userAgent?: string };

function sanitizeIp(value: string | null) {
  const candidate = value?.split(",")[0]?.trim();
  return candidate && /^[0-9a-f:.]{3,64}$/i.test(candidate) ? candidate : undefined;
}

export function getAuditRequestContext(request: Request): AuditRequestContext {
  const ipAddress = sanitizeIp(request.headers.get("x-forwarded-for")) ?? sanitizeIp(request.headers.get("x-real-ip"));
  const userAgent = request.headers.get("user-agent")?.replace(/[\r\n]/g, " ").trim().slice(0, 1000) || undefined;
  return { ...(ipAddress ? { ipAddress } : {}), ...(userAgent ? { userAgent } : {}) };
}

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => sanitizeAuditValue(entry, depth + 1));
  if (typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, SENSITIVE_KEY.test(key) && !SAFE_BANKING_KEY.test(key) ? "[redacted]" : sanitizeAuditValue(entry, depth + 1)]));
  return String(value);
}
