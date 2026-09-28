import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { CommissionRule, CommissionTransaction, MemberProfile, Role, SponsorRelationship, WalletTransaction } from "@/models";
import { PERMISSION } from "@/config/permissions";

test("member profiles require a valid human-readable member number and referral code", () => {
  const profile = new MemberProfile({ userId: new Types.ObjectId(), memberNumber: "invalid", referralCode: "bad", firstName: "Ada", lastName: "Lovelace" });
  const validationError = profile.validateSync();
  assert.ok(validationError?.errors.memberNumber);
  assert.ok(validationError?.errors.referralCode);
});

test("sponsor relationships reject self sponsorship and circular ancestry", async () => {
  const memberId = new Types.ObjectId();
  const relationship = new SponsorRelationship({ memberProfileId: memberId, sponsorMemberProfileId: memberId, uplineMemberProfileIds: [memberId] });
  await assert.rejects(relationship.validate(), /cannot sponsor themselves|circular upline/i);
});

test("level commission rules require a level and fixed rules require an amount", async () => {
  const rule = new CommissionRule({ name: "Invalid level", commissionType: "LEVEL", calculationBasis: "PV", rewardType: "FIXED", effectiveFrom: new Date() });
  await assert.rejects(rule.validate(), /require a level|require an amount/i);
});

test("wallet ledger query updates are blocked", async () => {
  await assert.rejects(WalletTransaction.updateOne({}, { $set: { description: "edited" } }).exec(), /immutable/i);
});

test("commission entitlement identity has a database unique index", () => {
  const indexes = CommissionTransaction.schema.indexes() as Array<[Record<string, 1 | -1>, { unique?: boolean }]>;
  const hasIdempotencyIndex = indexes.some(([keys, options]) => "sourceReferenceId" in keys && "recipientMemberProfileId" in keys && options.unique === true);
  assert.equal(hasIdempotencyIndex, true);
});

test("roles accept only catalog permission keys and reserve the super-admin grant", async () => {
  const invalidPermission = new Role({ name: "Finance manager", slug: "finance-manager", baseRole: "STAFF", permissions: ["wallet.anything"], isActive: true });
  await assert.rejects(invalidPermission.validate(), /centralized catalog/i);

  const superAdminWithStoredGrant = new Role({ name: "SUPER_ADMIN", slug: "super-admin", baseRole: "SUPER_ADMIN", isSystem: true, isActive: true, permissions: [PERMISSION.WALLET.ADJUST] });
  await assert.rejects(superAdminWithStoredGrant.validate(), /granted implicitly/i);

  await assert.rejects(Role.updateOne({}, { $set: { permissions: ["wallet.anything"] } }).exec(), /centralized catalog/i);
});
