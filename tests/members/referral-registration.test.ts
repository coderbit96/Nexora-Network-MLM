import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { registrationSchema } from "@/lib/validation/auth";
import { MemberProfile, Wallet } from "@/models";
import { assertReferralAssignment } from "@/services/members/referral-validation";

test("accepts a valid active referral assignment", () => {
  assert.doesNotThrow(() => assertReferralAssignment({ memberProfileId: new Types.ObjectId(), sponsorMemberProfileId: new Types.ObjectId(), sponsorStatus: "ACTIVE", uplineMemberProfileIds: [] }));
});

test("rejects an invalid referral code with no resolved sponsor", () => {
  assert.throws(() => assertReferralAssignment({ memberProfileId: new Types.ObjectId(), sponsorStatus: "ACTIVE" }), /referral code is invalid/i);
});

test("allows registration without a referral code", () => {
  const registration = registrationSchema.parse({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", password: "SecurePassword123" });
  assert.equal(registration.referralCode, undefined);
});

test("rejects an inactive referral sponsor", () => {
  assert.throws(() => assertReferralAssignment({ memberProfileId: new Types.ObjectId(), sponsorMemberProfileId: new Types.ObjectId(), sponsorStatus: "SUSPENDED", uplineMemberProfileIds: [] }), /sponsor is not active/i);
});

test("rejects referral cycles", () => {
  const member = new Types.ObjectId();
  assert.throws(() => assertReferralAssignment({ memberProfileId: member, sponsorMemberProfileId: new Types.ObjectId(), sponsorStatus: "ACTIVE", uplineMemberProfileIds: [member] }), /circular/i);
});

test("database indexes prevent duplicate member profiles and wallets", () => {
  const profileIndexes = MemberProfile.schema.indexes() as Array<[Record<string, 1 | -1>, { unique?: boolean }]>;
  const walletIndexes = Wallet.schema.indexes() as Array<[Record<string, 1 | -1>, { unique?: boolean }]>;
  const profileHasUniqueUser = profileIndexes.some(([keys, options]) => "userId" in keys && options.unique === true);
  const walletHasUniqueOwnerCurrency = walletIndexes.some(([keys, options]) => "memberProfileId" in keys && "currency" in keys && options.unique === true);
  assert.equal(profileHasUniqueUser, true);
  assert.equal(walletHasUniqueOwnerCurrency, true);
});
