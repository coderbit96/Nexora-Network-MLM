import "server-only";
import type { ClientSession } from "mongoose";
import { Notification, Role, User } from "@/models";

export async function notifyAdministrators(input: { type: "ORDER" | "WITHDRAWAL" | "SYSTEM"; title: string; body: string; actionUrl?: string; metadata?: Record<string, unknown>; session?: ClientSession }) {
  const roles = await Role.find({ name: { $in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true }).select("_id").session(input.session ?? null).lean(); const users = await User.find({ roleIds: { $in: roles.map((role) => role._id) }, status: "ACTIVE" }).select("_id").session(input.session ?? null).lean();
  if (users.length) await Notification.create(users.map((user) => ({ userId: user._id, type: input.type, title: input.title, body: input.body, ...(input.actionUrl ? { actionUrl: input.actionUrl } : {}), ...(input.metadata ? { metadata: input.metadata } : {}) })), input.session ? { session: input.session } : undefined);
}
