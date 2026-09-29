import assert from "node:assert/strict";
import test from "node:test";

import { adminMemberProfileUpdateSchema, adminMemberStatusSchema } from "@/lib/validation/member";
import { MemberManagementService, parseMemberListFilters } from "@/services/members/member-management-service";

test("member list filters bound pagination and support the required query controls", () => {
  const filters = parseMemberListFilters(new URLSearchParams({ page: "2", limit: "50", q: "mlm000010", status: "ACTIVE", sponsor: "SPONSOR10", from: "2026-01-01", to: "2026-01-31", sort: "name_asc" }));
  assert.equal(filters.page, 2);
  assert.equal(filters.limit, 50);
  assert.equal(filters.q, "mlm000010");
  assert.equal(filters.status, "ACTIVE");
  assert.equal(filters.sponsor, "SPONSOR10");
  assert.equal(filters.sort, "name_asc");
  assert.equal(filters.from?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(filters.to?.toISOString(), "2026-01-31T23:59:59.999Z");
});

test("member list filters reject oversized lists, unsafe sorts, and invalid date ranges", () => {
  assert.throws(() => parseMemberListFilters(new URLSearchParams({ limit: "101" })));
  assert.throws(() => parseMemberListFilters(new URLSearchParams({ page: "100001" })));
  assert.throws(() => parseMemberListFilters(new URLSearchParams({ sort: "createdAt;drop" })));
  assert.throws(() => parseMemberListFilters(new URLSearchParams({ from: "2026-02-01", to: "2026-01-01" })));
});

test("member restrictions require an audit reason and member profile updates reject financial mass assignment", () => {
  assert.throws(() => adminMemberStatusSchema.parse({ status: "SUSPENDED", reason: "short" }));
  assert.throws(() => adminMemberStatusSchema.parse({ status: "DISABLED" }));
  assert.deepEqual(adminMemberStatusSchema.parse({ status: "ACTIVE" }), { status: "ACTIVE" });
  assert.throws(() => adminMemberProfileUpdateSchema.parse({ firstName: "Member", lastName: "One", walletBalanceMinor: "100000" }));
});

test("member detail rejects malformed member identifiers before any database operation", async () => {
  await assert.rejects(() => MemberManagementService.detail("not-a-mongo-id"));
});
