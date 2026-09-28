import "server-only";

import { type ClientSession, type Types } from "mongoose";

import { sanitizeAuditValue, type AuditRequestContext } from "@/lib/security/audit-sanitization";
import { AuditLog } from "@/models";

export { getAuditRequestContext, sanitizeAuditValue, type AuditRequestContext } from "@/lib/security/audit-sanitization";
export type AuditInput = {
  actorUserId?: Types.ObjectId;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
} & AuditRequestContext;

function safeRecord(value: Record<string, unknown> | undefined) {
  return value ? sanitizeAuditValue(value) as Record<string, unknown> : undefined;
}

export class AuditService {
  static async record(input: AuditInput, session?: ClientSession) {
    const row = {
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      action: input.action.trim().slice(0, 150),
      resourceType: input.resourceType.trim().slice(0, 100),
      ...(input.resourceId ? { resourceId: input.resourceId.trim().slice(0, 120) } : {}),
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      ...(input.before ? { before: safeRecord(input.before) } : {}),
      ...(input.after ? { after: safeRecord(input.after) } : {}),
      ...(input.metadata ? { metadata: safeRecord(input.metadata) } : {}),
    };
    const created = await AuditLog.create([row], session ? { session } : undefined);
    return created[0];
  }

  static safeForDisplay(value: unknown) {
    return sanitizeAuditValue(value);
  }
}
