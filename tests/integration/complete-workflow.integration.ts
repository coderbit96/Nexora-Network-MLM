import assert from "node:assert/strict";
import test, { after } from "node:test";
import { Types, startSession, disconnect } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { Cart, Category, CommissionRule, CommissionTransaction, MemberPaymentDetails, MemberProfile, Notification, Order, Payment, Product, Role, SponsorRelationship, User, Wallet, WalletTransaction, Withdrawal } from "@/models";
import { resolveValidUpline } from "@/services/genealogy/sponsor-assignment";
import { OrderService } from "@/services/orders/order-service";
import { PaymentService } from "@/services/payments/payment-service";
import { WithdrawalService } from "@/services/withdrawal/withdrawal-service";
import { SystemSettingsService } from "@/services/settings/system-settings-service";
import { defaultBusinessSettings } from "@/lib/validation/settings";
import { ensureSystemRbac } from "@/services/auth/rbac";
import { RoleService } from "@/services/auth/role-service";
import { PERMISSION } from "@/config/permissions";
import { CommissionService } from "@/services/commission/commission-service";
import { WalletService } from "@/services/wallet/wallet-service";

const testUri = process.env.MLM_TEST_MONGODB_URI;
const testDatabase = process.env.MLM_TEST_MONGODB_DB_NAME;
const integrationEnabled = Boolean(testUri && testDatabase);
const requiredTestDatabaseName = /(?:^|[-_])test$/i;
after(async () => { await disconnect(); });

type CreatedMember = { userId: Types.ObjectId; profileId: Types.ObjectId; referralCode: string };

function configureIntegrationEnvironment() {
  if (!testUri || !testDatabase) throw new Error("MLM_TEST_MONGODB_URI and MLM_TEST_MONGODB_DB_NAME are required.");
  if (!requiredTestDatabaseName.test(testDatabase)) throw new Error("MLM_TEST_MONGODB_DB_NAME must end in '-test' or '_test'.");
  process.env.MONGODB_URI = testUri;
  process.env.MONGODB_DB_NAME = testDatabase;
  process.env.PAYMENT_PROVIDER = "mock";
  process.env.PAYMENT_MOCK_ENABLED = "true";
  process.env.PAYMENT_API_KEY = "integration-test-key";
  process.env.PAYMENT_WEBHOOK_SECRET = "integration-test-webhook-secret";
  process.env.FIELD_ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || Buffer.alloc(32, 7).toString("base64");
  process.env.FIREBASE_ADMIN_PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID || "integration-test-project";
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "integration-test@example.test";
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = process.env.FIREBASE_ADMIN_PRIVATE_KEY || "integration-test-private-key";
}

async function createMember(input: { sequence: number; roleId: Types.ObjectId; sponsorReferralCode?: string }): Promise<CreatedMember> {
  const session = await startSession();
  let created: CreatedMember | undefined;
  try {
    await session.withTransaction(async () => {
      const user = await User.create([{ firebaseUid: `e2e-${input.sequence}`, email: `member-${input.sequence}@example.test`, displayName: `Member ${input.sequence}`, status: "ACTIVE", roleIds: [input.roleId] }], { session });
      const profile = await MemberProfile.create([{ userId: user[0]._id, memberNumber: `MLM${String(input.sequence).padStart(6, "0")}`, referralCode: `REF${String(input.sequence).padStart(6, "0")}`, firstName: `Member`, lastName: String(input.sequence), activationStatus: "ACTIVE" }], { session });
      if (input.sponsorReferralCode) {
        const sponsor = await MemberProfile.findOne({ referralCode: input.sponsorReferralCode, activationStatus: "ACTIVE" }).session(session).lean();
        assert.ok(sponsor, "the referral code must resolve to an active sponsor");
        const uplines = await resolveValidUpline({ memberProfileId: profile[0]._id, sponsorMemberProfileId: sponsor._id, session });
        await SponsorRelationship.create([{ memberProfileId: profile[0]._id, sponsorMemberProfileId: sponsor._id, uplineMemberProfileIds: uplines }], { session });
      }
      await Wallet.create([{ memberProfileId: profile[0]._id, currency: "INR", availableMinor: 0n, heldMinor: 0n, lifetimeCreditMinor: 0n, lifetimeDebitMinor: 0n, lifetimeEarningsMinor: 0n, lifetimeWithdrawalsMinor: 0n }], { session });
      created = { userId: user[0]._id, profileId: profile[0]._id, referralCode: profile[0].referralCode };
    });
  } finally { await session.endSession(); }
  if (!created) throw new Error("Test member was not created.");
  return created;
}

test("database E2E: referral registration, verified payment, commissions, and withdrawal settlement remain consistent", { skip: integrationEnabled ? false : "Set MLM_TEST_MONGODB_URI and MLM_TEST_MONGODB_DB_NAME to run database integration tests." }, async () => {
  configureIntegrationEnvironment();
  const connection = await connectToDatabase();
  const database = connection.connection.db;
  if (!database || !requiredTestDatabaseName.test(connection.connection.name)) throw new Error("Refusing to run destructive integration tests outside a dedicated test database.");
  await database.dropDatabase();
  const indexedModels = [Cart, Category, CommissionRule, CommissionTransaction, MemberPaymentDetails, MemberProfile, Order, Payment, Role, SponsorRelationship, User, Wallet, WalletTransaction, Withdrawal];
  await Promise.all(indexedModels.map((model) => model.syncIndexes()));

  try {
    const [adminRole, memberRole] = await Role.create([{ name: "SUPER_ADMIN", slug: "super-admin", baseRole: "SUPER_ADMIN", description: "Integration test administrator", isSystem: true, isActive: true, permissions: [] }, { name: "MEMBER", slug: "member", baseRole: "MEMBER", description: "Integration test member", isSystem: true, isActive: true, permissions: [] }]);
    const admin = await User.create({ firebaseUid: "e2e-admin", email: "admin@example.test", displayName: "Integration Admin", status: "ACTIVE", roleIds: [adminRole._id] });
    // Test policy is explicit; production's default minimum remains unchanged.
    await SystemSettingsService.update({ actorUserId: admin._id, settings: { ...defaultBusinessSettings, withdrawal: { ...defaultBusinessSettings.withdrawal, minimumMinor: "1000" } } });
    await ensureSystemRbac();
    const staffRole = await Role.findOne({ name: "STAFF" });
    assert.ok(staffRole);
    staffRole.permissions = [PERMISSION.MEMBERS.VIEW];
    await staffRole.save();
    await ensureSystemRbac();
    assert.deepEqual((await Role.findById(staffRole._id).lean())?.permissions, [PERMISSION.MEMBERS.VIEW], "registration must preserve revoked grants");
    await assert.rejects(RoleService.update(String(staffRole._id), { permissions: [PERMISSION.WALLET.ADJUST] }, {
      actorUserId: admin._id, actor: { status: "ACTIVE", roles: ["STAFF"], permissions: [PERMISSION.ROLES.EDIT] },
    }), /access|permission|forbidden/i);

    // Member A exists; B and C are created using the persisted referral codes of their sponsors.
    const memberA = await createMember({ sequence: 1, roleId: memberRole._id });
    const memberB = await createMember({ sequence: 2, roleId: memberRole._id, sponsorReferralCode: memberA.referralCode });
    const memberC = await createMember({ sequence: 3, roleId: memberRole._id, sponsorReferralCode: memberB.referralCode });
    const cRelationship = await SponsorRelationship.findOne({ memberProfileId: memberC.profileId }).lean();
    assert.deepEqual(cRelationship?.uplineMemberProfileIds.map(String), [String(memberB.profileId), String(memberA.profileId)]);

    // Admin-configured rules: direct=10%, level 1=5%, level 2=2% on the authoritative order subtotal.
    const effectiveFrom = new Date(Date.now() - 60_000);
    await CommissionRule.create([
      { name: "Direct 10", commissionType: "DIRECT", calculationBasis: "ORDER_SUBTOTAL", rewardType: "PERCENTAGE", rateBasisPoints: 1_000, active: true, effectiveFrom },
      { name: "Level 1 5", commissionType: "LEVEL", level: 1, calculationBasis: "ORDER_SUBTOTAL", rewardType: "PERCENTAGE", rateBasisPoints: 500, active: true, effectiveFrom },
      { name: "Level 2 2", commissionType: "LEVEL", level: 2, calculationBasis: "ORDER_SUBTOTAL", rewardType: "PERCENTAGE", rateBasisPoints: 200, active: true, effectiveFrom },
    ]);

    const category = await Category.create({ name: "Integration catalogue", slug: "integration-catalogue", status: "ACTIVE" });
    const product = await Product.create({ categoryId: category._id, name: "Authoritative test product", slug: "authoritative-test-product", sku: "E2E-001", priceMinor: 10_005n, currency: "INR", pv: 50n, bv: 75n, stockQuantity: 5, commissionEligible: true, status: "ACTIVE" });
    await Cart.create({ memberProfileId: memberC.profileId, items: [{ productId: product._id, quantity: 1 }] });

    // Checkout reads persisted product values. No browser price/PV/BV can influence this total.
    const checkout = await OrderService.checkout(memberC.profileId, "e2e-checkout-1");
    assert.equal(checkout.created, true);
    const order = await Order.findById(checkout.orderId).lean();
    assert.equal(order?.subtotalMinor, 10_005n);
    assert.equal(order?.items[0].unitPriceMinor, 10_005n);
    const payment = await Payment.findOne({ orderId: checkout.orderId }).lean();
    assert.ok(payment);

    // Only the server-owned mock provider may create the development payment success event.
    await PaymentService.createPayment(memberC.profileId, checkout.orderId);
    await PaymentService.simulateMockSuccess(memberC.profileId, String(payment._id));
    const settledOrder = await Order.findById(checkout.orderId).lean();
    assert.equal(settledOrder?.paymentStatus, "SUCCESS");
    assert.equal(settledOrder?.commissionStatus, "COMPLETED");

    const commissions = await CommissionTransaction.find({ sourceOrderId: order?._id }).sort({ level: 1 }).lean();
    assert.equal(commissions.length, 3);
    assert.deepEqual(commissions.map((entry) => [String(entry.recipientMemberProfileId), entry.commissionType, entry.level ?? null, entry.amountMinor]), [
      [String(memberB.profileId), "DIRECT", null, 1_000n],
      [String(memberB.profileId), "LEVEL", 1, 500n],
      [String(memberA.profileId), "LEVEL", 2, 200n],
    ]);
    const [walletA, walletB] = await Promise.all([Wallet.findOne({ memberProfileId: memberA.profileId }).lean(), Wallet.findOne({ memberProfileId: memberB.profileId }).lean()]);
    assert.equal(walletA?.availableMinor, 200n);
    assert.equal(walletB?.availableMinor, 1_500n);
    assert.equal(await WalletTransaction.countDocuments({ memberProfileId: memberB.profileId, type: { $in: ["DIRECT_COMMISSION", "LEVEL_COMMISSION"] } }), 2);

    // Simultaneous payment initiation is claimed atomically before a provider is called. A
    // second caller either receives the same initialized payment or a conflict; it never gains
    // a second provider transaction ID for this order.
    await Cart.updateOne({ memberProfileId: memberC.profileId }, { $set: { items: [{ productId: product._id, quantity: 1 }] } });
    const secondCheckout = await OrderService.checkout(memberC.profileId, "e2e-checkout-payment-race");
    const initiationAttempts = await Promise.allSettled([
      PaymentService.createPayment(memberC.profileId, secondCheckout.orderId),
      PaymentService.createPayment(memberC.profileId, secondCheckout.orderId),
    ]);
    const initialized = initiationAttempts.filter((attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof PaymentService.createPayment>>> => attempt.status === "fulfilled");
    assert.ok(initialized.length >= 1);
    assert.equal(new Set(initialized.map((attempt) => attempt.value.providerTransactionId)).size, 1);
    assert.equal(await Payment.countDocuments({ orderId: secondCheckout.orderId }), 1);

    // A valid payment destination is required before B can reserve its earned balance for withdrawal.
    await MemberPaymentDetails.create({ memberProfileId: memberB.profileId, accountHolderNameEncrypted: "test", bankNameEncrypted: "test", accountNumberEncrypted: "test", ifscCodeEncrypted: "test", accountLast4: "1234" });
    const request = await WithdrawalService.request({ memberProfileId: memberB.profileId, amountMinor: 1_000n, idempotencyKey: "e2e-withdrawal-1" });
    const duplicateRequest = await WithdrawalService.request({ memberProfileId: memberB.profileId, amountMinor: 1_000n, idempotencyKey: "e2e-withdrawal-1" });
    assert.equal(duplicateRequest.created, false);
    assert.equal(duplicateRequest.id, request.id);
    await WithdrawalService.transition({ withdrawalId: new Types.ObjectId(request.id), targetStatus: "APPROVED", actorUserId: admin._id });
    await WithdrawalService.transition({ withdrawalId: new Types.ObjectId(request.id), targetStatus: "PROCESSING", actorUserId: admin._id });
    await WithdrawalService.transition({ withdrawalId: new Types.ObjectId(request.id), targetStatus: "COMPLETED", actorUserId: admin._id, paymentReference: "E2E-PAYOUT-001" });
    await assert.rejects(WithdrawalService.transition({ withdrawalId: new Types.ObjectId(request.id), targetStatus: "REJECTED", actorUserId: admin._id, note: "Invalid after completion" }), /Invalid withdrawal transition/);

    const [withdrawal, finalWalletB] = await Promise.all([Withdrawal.findById(request.id).lean(), Wallet.findOne({ memberProfileId: memberB.profileId }).lean()]);
    assert.equal(withdrawal?.status, "COMPLETED");
    assert.equal(withdrawal?.statusHistory.map((entry) => entry.status).join(","), "PENDING,APPROVED,PROCESSING,COMPLETED");
    assert.equal(finalWalletB?.availableMinor, 500n);
    assert.equal(finalWalletB?.heldMinor, 0n);
    assert.equal(finalWalletB?.lifetimeWithdrawalsMinor, 1_000n);
    assert.equal(await WalletTransaction.countDocuments({ memberProfileId: memberB.profileId }), 4);
    // Replaying payment/commission processing must leave all entitlements unchanged.
    await Promise.all([
      PaymentService.simulateMockSuccess(memberC.profileId, String(payment._id)),
      CommissionService.processEligibleOrder(checkout.orderId),
      CommissionService.processEligibleOrder(checkout.orderId),
    ]);
    assert.equal(await CommissionTransaction.countDocuments({ sourceOrderId: checkout.orderId }), 3);
    assert.equal((await Wallet.findOne({ memberProfileId: memberB.profileId }).lean())?.availableMinor, 500n);
    // Actual concurrent database writes, not just arithmetic simulations.
    const posting = { memberProfileId: memberB.profileId, currency: "INR", type: "ADMIN_CREDIT" as const, direction: "CREDIT" as const, amountMinor: 37n, referenceType: "TEST", referenceId: "credit", description: "Isolated concurrency test" };
    await Promise.all([WalletService.post({ ...posting, idempotencyKey: "race-credit-a" }), WalletService.post({ ...posting, idempotencyKey: "race-credit-b" })]);
    assert.equal((await Wallet.findOne({ memberProfileId: memberB.profileId }).lean())?.availableMinor, 574n);
    await assert.rejects(
      WalletService.post({ ...posting, amountMinor: 38n, idempotencyKey: "race-credit-a" }),
      /already been used for a different wallet operation/i,
      "a retry key must never authorize a different financial posting",
    );
    assert.equal((await Wallet.findOne({ memberProfileId: memberB.profileId }).lean())?.availableMinor, 574n);
    const exactAmount = 9_007_199_254_740_993n;
    await WalletService.post({ ...posting, memberProfileId: memberA.profileId, amountMinor: exactAmount, idempotencyKey: "precision-credit" });
    assert.equal((await Wallet.findOne({ memberProfileId: memberA.profileId }).lean())?.availableMinor, exactAmount + 200n);

    // Commission processing only accepts a verified payment, not a caller-shaped “paid” order.
    const unverifiedOrder = await Order.create({ orderNumber: "E2E00000002", memberProfileId: memberC.profileId, currency: "INR", items: [{ productId: product._id, sku: product.sku, name: product.name, quantity: 1, unitPriceMinor: product.priceMinor, lineTotalMinor: product.priceMinor, pv: product.pv, bv: product.bv, commissionEligible: true }], subtotalMinor: product.priceMinor, discountMinor: 0n, taxMinor: 0n, totalMinor: product.priceMinor, status: "PAID", paymentStatus: "PENDING", commissionStatus: "PENDING", checkoutIdempotencyKey: "unverified-commission-order", paidAt: new Date() });
    const unverifiedResult = await CommissionService.processEligibleOrder(String(unverifiedOrder._id));
    assert.deepEqual(unverifiedResult, { orderId: String(unverifiedOrder._id), processed: false, reason: "NOT_ELIGIBLE", commissionsCreated: 0, amountMinor: 0n });
    assert.equal(await CommissionTransaction.countDocuments({ sourceOrderId: unverifiedOrder._id }), 0);

    // A failure after wallet/commission writes but before notification commit must roll back every
    // financial side effect and release the source order for a later safe retry.
    const rollbackOrder = await Order.create({ orderNumber: "E2E00000003", memberProfileId: memberC.profileId, currency: "INR", items: [{ productId: product._id, sku: product.sku, name: product.name, quantity: 1, unitPriceMinor: product.priceMinor, lineTotalMinor: product.priceMinor, pv: product.pv, bv: product.bv, commissionEligible: true }], subtotalMinor: product.priceMinor, discountMinor: 0n, taxMinor: 0n, totalMinor: product.priceMinor, status: "PAID", paymentStatus: "SUCCESS", commissionStatus: "PENDING", checkoutIdempotencyKey: "rollback-commission-order", paidAt: new Date() });
    const walletBeforeRollback = await Wallet.findOne({ memberProfileId: memberB.profileId }).lean();
    const notificationModel = Notification as unknown as { create: typeof Notification.create };
    const notificationCreate = Notification.create.bind(Notification);
    notificationModel.create = (async () => { throw new Error("forced notification failure"); }) as typeof Notification.create;
    try {
      await assert.rejects(CommissionService.processEligibleOrder(String(rollbackOrder._id)), /forced notification failure/);
    } finally {
      notificationModel.create = notificationCreate;
    }
    assert.equal((await Order.findById(rollbackOrder._id).lean())?.commissionStatus, "PENDING");
    assert.equal(await CommissionTransaction.countDocuments({ sourceOrderId: rollbackOrder._id }), 0);
    assert.equal(await WalletTransaction.countDocuments({ "metadata.sourceOrderId": String(rollbackOrder._id) }), 0);
    assert.equal(await Notification.countDocuments({ "metadata.orderId": String(rollbackOrder._id) }), 0);
    assert.equal((await Wallet.findOne({ memberProfileId: memberB.profileId }).lean())?.availableMinor, walletBeforeRollback?.availableMinor);
  } finally {
    // The explicit database-name guard above makes this cleanup safe and leaves no test financial data behind.
    await database.dropDatabase();
  }
});
