import { type Model, model, models, Schema } from "mongoose";

import type { IAuditLog } from "@/types/domain";
import { makeImmutable, schemaOptions } from "./model-utils";

const sensitiveKey = /password|token|secret|private.?key|credential|authorization|cookie|account.?number|ifsc|bank|card|cvv|payment.?detail/i;
const safeBankingKey = /accountlast4/i;
function redact(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.slice(0, 1000);
  if (depth >= 6) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => redact(entry, depth + 1));
  if (typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sensitiveKey.test(key) && !safeBankingKey.test(key) ? "[redacted]" : redact(entry, depth + 1)]));
  return String(value);
}

const AuditLogSchema = new Schema<IAuditLog>({
  actorUserId: { type: Schema.Types.ObjectId, ref: "User", immutable: true },
  action: { type: String, required: true, immutable: true, trim: true, maxlength: 150, index: true },
  resourceType: { type: String, required: true, immutable: true, trim: true, maxlength: 100, index: true },
  resourceId: { type: String, immutable: true, trim: true, maxlength: 120 },
  ipAddress: { type: String, immutable: true, trim: true, maxlength: 64 },
  userAgent: { type: String, immutable: true, trim: true, maxlength: 1000 },
  before: { type: Schema.Types.Mixed, immutable: true },
  after: { type: Schema.Types.Mixed, immutable: true },
  metadata: { type: Schema.Types.Mixed, immutable: true },
}, schemaOptions);
AuditLogSchema.index({ actorUserId: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, action: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.pre("validate", function () {
  if (this.before) this.before = redact(this.before) as Record<string, unknown>;
  if (this.after) this.after = redact(this.after) as Record<string, unknown>;
  if (this.metadata) this.metadata = redact(this.metadata) as Record<string, unknown>;
  if (this.ipAddress && !/^[0-9a-f:.]{3,64}$/i.test(this.ipAddress)) this.ipAddress = undefined;
  if (this.userAgent) this.userAgent = this.userAgent.replace(/[\r\n]/g, " ").slice(0, 1000);
});
makeImmutable(AuditLogSchema);
export const AuditLog: Model<IAuditLog> = (models.AuditLog as Model<IAuditLog>) || model<IAuditLog>("AuditLog", AuditLogSchema);
