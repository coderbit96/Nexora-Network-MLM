import "server-only";

import { Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { MemberProfile, Order } from "@/models";
import { parseOrderFilters, serializeOrder, type OrderFilters } from "@/services/orders/order-query";

export type AdminOrderFilters = OrderFilters & { member?: string; orderId?: Types.ObjectId };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Parses only bounded primitive values used by the administrative order list. */
export function parseAdminOrderFilters(params: URLSearchParams): AdminOrderFilters {
  const filters = parseOrderFilters(params);
  const member = params.get("member")?.trim().slice(0, 100) || undefined;
  const rawOrderId = params.get("order")?.trim();
  if (rawOrderId && !Types.ObjectId.isValid(rawOrderId)) throw errors.badRequest("Invalid order identifier.");
  return { ...filters, ...(member ? { member } : {}), ...(rawOrderId ? { orderId: new Types.ObjectId(rawOrderId) } : {}) };
}

/** Returns a paginated, server-filtered order list for the Super Admin workspace. */
export async function getAdminOrderPage(filters: AdminOrderFilters) {
  const matchingProfiles = filters.member ? await MemberProfile.find({
    $or: [
      { memberNumber: new RegExp(escapeRegex(filters.member), "i") },
      { firstName: new RegExp(escapeRegex(filters.member), "i") },
      { lastName: new RegExp(escapeRegex(filters.member), "i") },
    ],
  }).select("_id").limit(1_000).lean() : undefined;
  const query = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(matchingProfiles ? { memberProfileId: { $in: matchingProfiles.map((profile) => profile._id) } } : {}),
    ...(filters.orderId ? { _id: filters.orderId } : {}),
  };
  const [orders, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1, _id: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    Order.countDocuments(query),
  ]);
  const profiles = orders.length ? await MemberProfile.find({ _id: { $in: orders.map((order) => order.memberProfileId) } }).select("memberNumber firstName lastName").lean() : [];
  const byId = new Map(profiles.map((profile) => [String(profile._id), profile]));
  return {
    orders: orders.map((order) => {
      const profile = byId.get(String(order.memberProfileId));
      return {
        ...serializeOrder(order),
        member: profile ? { id: String(profile._id), memberNumber: profile.memberNumber, name: `${profile.firstName} ${profile.lastName}`.trim() } : null,
      };
    }),
    pagination: { total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) },
  };
}
