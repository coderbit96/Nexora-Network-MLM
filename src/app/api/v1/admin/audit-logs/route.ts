import { z } from "zod";

import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { AuditLog, User } from "@/models";
import { sanitizeAuditValue } from "@/services/audit/audit-service";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const filtersSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
  action: z.string().trim().max(150).optional(),
  resourceType: z.string().trim().max(100).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const GET = withApiErrorHandling(async (request: Request) => {
  await requirePermission(PERMISSION.AUDIT.VIEW, request);
  const url = new URL(request.url);
  const input = filtersSchema.parse(Object.fromEntries(url.searchParams));
  if (input.from && input.to && input.from > input.to) throw errors.badRequest("Start date must not be after end date.");
  const createdAt = { ...(input.from ? { $gte: new Date(`${input.from}T00:00:00.000Z`) } : {}), ...(input.to ? { $lt: new Date(new Date(`${input.to}T00:00:00.000Z`).getTime() + 86_400_000) } : {}) };
  const query: Record<string, unknown> = { ...(input.action ? { action: input.action } : {}), ...(input.resourceType ? { resourceType: input.resourceType } : {}), ...(Object.keys(createdAt).length ? { createdAt } : {}) };
  if (input.q) query.$or = [{ action: new RegExp(escapeRegex(input.q), "i") }, { resourceType: new RegExp(escapeRegex(input.q), "i") }, { resourceId: new RegExp(escapeRegex(input.q), "i") }];
  const skip = (input.page - 1) * input.limit;
  const [rows, total] = await Promise.all([AuditLog.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(input.limit).lean(), AuditLog.countDocuments(query)]);
  const actorIds = rows.flatMap((row) => row.actorUserId ? [row.actorUserId] : []);
  const actors = actorIds.length ? await User.find({ _id: { $in: actorIds } }).select("displayName email").lean() : [];
  const actorById = new Map(actors.map((actor) => [String(actor._id), `${actor.displayName} (${actor.email})`]));
  return apiSuccess({ items: rows.map((row) => ({ id: String(row._id), action: row.action, resourceType: row.resourceType, resourceId: row.resourceId ?? "—", actor: row.actorUserId ? actorById.get(String(row.actorUserId)) ?? "Deleted user" : "System", before: sanitizeAuditValue(row.before ?? {}), after: sanitizeAuditValue(row.after ?? {}), metadata: sanitizeAuditValue(row.metadata ?? {}), ipAddress: row.ipAddress ?? null, userAgent: row.userAgent ?? null, createdAt: row.createdAt.toISOString() })), pagination: { total, page: input.page, limit: input.limit, totalPages: Math.max(1, Math.ceil(total / input.limit)) } });
});
