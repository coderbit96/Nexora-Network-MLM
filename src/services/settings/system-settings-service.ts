import "server-only";

import { type ClientSession, startSession, type Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import { businessSettingsSchema, defaultBusinessSettings, type BusinessSettings } from "@/lib/validation/settings";
import { CommissionTransaction, Order, Payment, Product, Setting, Wallet } from "@/models";
import { AuditService, type AuditRequestContext } from "@/services/audit/audit-service";

const SETTINGS_KEY = "business.configuration";

type SettingsRead = { settings: BusinessSettings; updatedAt?: Date; updatedByUserId?: string };

function parseStored(value: unknown): BusinessSettings {
  return businessSettingsSchema.parse(value);
}

function changedPaths(before: unknown, after: unknown, prefix = ""): string[] {
  if (Object.is(before, after)) return [];
  if (!before || !after || typeof before !== "object" || typeof after !== "object" || Array.isArray(before) || Array.isArray(after)) return [prefix];
  const keys = new Set([...Object.keys(before as Record<string, unknown>), ...Object.keys(after as Record<string, unknown>)]);
  return [...keys].flatMap((key) => changedPaths((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key));
}

export class SystemSettingsService {
  static async read(session?: ClientSession): Promise<SettingsRead> {
    await connectToDatabase();
    const query = Setting.findOne({ key: SETTINGS_KEY }).select("key value updatedAt updatedByUserId");
    if (session) query.session(session);
    const row = await query.lean();
    if (!row) return { settings: structuredClone(defaultBusinessSettings) };
    return { settings: parseStored(row.value), updatedAt: row.updatedAt, ...(row.updatedByUserId ? { updatedByUserId: String(row.updatedByUserId) } : {}) };
  }

  static async update(input: { settings: BusinessSettings; actorUserId: Types.ObjectId } & AuditRequestContext) {
    const settings = businessSettingsSchema.parse(input.settings);
    await connectToDatabase();
    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        const existing = await Setting.findOne({ key: SETTINGS_KEY }).session(session);
        const before = existing ? parseStored(existing.value) : structuredClone(defaultBusinessSettings);
        if (before.currency !== settings.currency) {
          const financialDataExists = await Promise.all([Wallet.exists({}).session(session), Product.exists({}).session(session), Order.exists({}).session(session), Payment.exists({}).session(session), CommissionTransaction.exists({}).session(session)]);
          if (financialDataExists.some(Boolean)) throw errors.conflict("Base currency cannot change after products, wallets, orders, payments, or commissions exist. Historical records retain their original currency.");
        }
        const updates = changedPaths(before, settings).filter(Boolean);
        if (!updates.length && existing) return;
        if (existing) {
          existing.value = settings;
          existing.valueType = "JSON";
          existing.updatedByUserId = input.actorUserId;
          await existing.save({ session });
        } else {
          await Setting.create([{ key: SETTINGS_KEY, value: settings, valueType: "JSON", isSecret: false, updatedByUserId: input.actorUserId }], { session });
        }
        await AuditService.record({ actorUserId: input.actorUserId, action: "settings.business_configuration_updated", resourceType: "Setting", resourceId: SETTINGS_KEY, ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}), ...(input.userAgent ? { userAgent: input.userAgent } : {}), before, after: settings, metadata: { changedPaths: updates } }, session);
      });
    } finally { await session.endSession(); }
    return this.read();
  }
}
