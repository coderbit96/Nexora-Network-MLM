import assert from "node:assert/strict";
import test, { after } from "node:test";
import { Types, startSession, disconnect } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { AuditLog, Cart, Category, CommissionRule, CommissionTransaction, MemberPaymentDetails, MemberProfile, Notification, Order, Payment, Product, Role, SponsorRelationship, User, Wallet, WalletTransaction, Withdrawal } from "@/models";
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
import { CommissionManagementService } from "@/services/commission/commission-management-service";
import { DashboardService, parseAdminDashboardRange } from "@/services/dashboard/admin-dashboard";
import { getMemberDashboard } from "@/services/dashboard/member-dashboard";
import { GenealogyService } from "@/services/genealogy/genealogy";
import { MemberManagementService } from "@/services/members/member-management-service";
import { memberOrders } from "@/services/orders/order-query";
import { getReportPage } from "@/services/reports/report-service";
import { getAdminWithdrawalDetail } from "@/services/withdrawal/admin-withdrawal-query";
import { getWalletLedgerPage } from "@/services/wallet/wallet-ledger-service";
import { getWalletOverview, getWalletTransactionPage } from "@/services/wallet/wallet-query";

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

async function createMember(input: { label: "A" | "B" | "C"; sequence: number; roleId: Types.ObjectId; sponsorReferralCode?: string }): Promise<CreatedMember> {
  const session = await startSession();
  let created: CreatedMember | undefined;
  try {
    await session.withTransaction(async () => {
      const user = await User.create([{ firebaseUid: `e2e-member-${input.label.toLowerCase()}`, email: `member-${input.label.toLowerCase()}@example.test`, displayName: `Member ${input.label}`, status: "ACTIVE", roleIds: [input.roleId] }], { session });
      const profile = await MemberProfile.create([{ userId: user[0]._id, memberNumber: `MLM${String(input.sequence).padStart(6, "0")}`, referralCode: `REF${String(input.sequence).padStart(6, "0")}`, firstName: "Member", lastName: input.label, activationStatus: "ACTIVE" }], { session });
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
  const indexedModels = [AuditLog, Cart, Category, CommissionRule, CommissionTransaction, MemberPaymentDetails, MemberProfile, Notification, Order, Payment, Product, Role, SponsorRelationship, User, Wallet, WalletTransaction, Withdrawal];
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
    const memberA = await createMember({ label: "A", sequence: 1, roleId: memberRole._id });
    const memberB = await createMember({ label: "B", sequence: 2, roleId: memberRole._id, sponsorReferralCode: memberA.referralCode });
    const memberC = await createMember({ label: "C", sequence: 3, roleId: memberRole._id, sponsorReferralCode: memberB.referralCode });
    assert.ok(await MemberProfile.exists({ _id: memberC.profileId }), "Member C must be visible in the Members data set");
    const cRelationship = await SponsorRelationship.findOne({ memberProfileId: memberC.profileId }).lean();
    assert.deepEqual(cRelationship?.uplineMemberProfileIds.map(String), [String(memberB.profileId), String(memberA.profileId)]);
    const [cSponsor, bDirectReferrals, bTeamStats] = await Promise.all([
      GenealogyService.getSponsor(memberC.profileId),
      GenealogyService.getDirectReferrals(memberB.profileId),
      GenealogyService.getTeamStats(memberB.profileId),
    ]);
    assert.equal(cSponsor?.id, String(memberB.profileId), "Genealogy must show B as C's direct sponsor");
    assert.ok(bDirectReferrals.children.some((member) => member.id === String(memberC.profileId)), "Genealogy must show C under B");
    assert.deepEqual(bTeamStats, { directCount: 1, teamCount: 1, levelCounts: [{ level: 1, count: 1 }] });

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
    const settledPayment = await Payment.findById(payment._id).lean();
    assert.equal(settledPayment?.status, "SUCCESS", "The authoritative payment record must be settled");

    const commissions = await CommissionTransaction.find({ sourceOrderId: order?._id }).sort({ level: 1 }).lean();
    assert.equal(commissions.length, 3);
    assert.deepEqual(commissions.map((entry) => [String(entry.recipientMemberProfileId), entry.commissionType, entry.level ?? null, entry.amountMinor]), [
      [String(memberB.profileId), "DIRECT", null, 1_000n],
      [String(memberB.profileId), "LEVEL", 1, 500n],
      [String(memberA.profileId), "LEVEL", 2, 200n],
    ]);
    assert.deepEqual(commissions.map((entry) => entry.rateBasisPoints), [1_000, 500, 200], "Commission records must preserve the configured rule rates that created them");
    const [walletA, walletB] = await Promise.all([Wallet.findOne({ memberProfileId: memberA.profileId }).lean(), Wallet.findOne({ memberProfileId: memberB.profileId }).lean()]);
    assert.equal(walletA?.availableMinor, 200n);
    assert.equal(walletB?.availableMinor, 1_500n);
    assert.equal(await WalletTransaction.countDocuments({ memberProfileId: memberB.profileId, type: { $in: ["DIRECT_COMMISSION", "LEVEL_COMMISSION"] } }), 2);
    assert.equal(await WalletTransaction.countDocuments({ _id: { $in: commissions.map((entry) => entry.walletTransactionId) } }), 3, "Every commission must reference one immutable wallet entry");
    assert.equal(await Notification.countDocuments({ userId: { $in: [memberA.userId, memberB.userId] }, type: "COMMISSION" }), 3, "Every credited commission must notify its beneficiary");

    const [memberCDetail, memberBCommissionHistory, memberBWallet] = await Promise.all([
      MemberManagementService.detail(String(memberC.profileId)),
      CommissionManagementService.transactions({ page: 1, limit: 25, member: "MLM000002" }),
      getWalletOverview(memberB.profileId),
    ]);
    assert.equal(memberCDetail.overview.sponsor?.id, String(memberB.profileId), "Member Detail must use the same sponsor relationship as Genealogy");
    assert.equal(memberCDetail.overview.orderSummary?.count, 1, "Member Detail must show C's paid order");
    assert.equal(memberBCommissionHistory.pagination.total, 2, "Commission history must show B's direct and level credits");
    assert.equal(memberBWallet.availableMinor, 1_500n, "Wallet summary must equal the credited ledger balance before withdrawal");

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
    assert.equal((await Withdrawal.findById(request.id).lean())?.status, "PENDING", "A new withdrawal must enter the pending queue");
    assert.equal(await Notification.countDocuments({ userId: memberB.userId, type: "WITHDRAWAL", title: "Withdrawal requested" }), 1, "The member must be notified when the request is submitted");
    await WithdrawalService.transition({ withdrawalId: new Types.ObjectId(request.id), targetStatus: "APPROVED", actorUserId: admin._id });
    assert.equal((await Withdrawal.findById(request.id).lean())?.status, "APPROVED", "Approval must persist before processing is allowed");
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
    assert.equal(await Notification.countDocuments({ userId: memberB.userId, type: "WITHDRAWAL" }), 4, "Submission and every valid withdrawal transition must notify the member");
    assert.equal(await AuditLog.countDocuments({ actorUserId: admin._id, action: "withdrawal.status_changed", resourceId: request.id }), 3, "All administrative withdrawal transitions must be audited");
    assert.ok(await AuditLog.exists({ action: "commission.processed", resourceId: checkout.orderId }), "Commission processing must be auditable");

    // These read services back the real screens. They must agree with the
    // canonical models above rather than reconstructing a separate view model.
    const [withdrawalDetail, ledgerPage, memberBTransactions, memberDashboard, ordersPage, commissionReport, walletReport, withdrawalReport, salesReport, ordersReport, memberReport, referralReport] = await Promise.all([
      getAdminWithdrawalDetail(request.id),
      getWalletLedgerPage({ page: 1, limit: 25, member: "MLM000002" }),
      getWalletTransactionPage(memberB.profileId, { page: 1, limit: 25 }),
      getMemberDashboard(memberB.profileId, "https://example.test"),
      memberOrders(memberC.profileId, { page: 1, limit: 25 }),
      getReportPage("commissions", { page: 1, limit: 25, memberNumber: "MLM000002" }),
      getReportPage("wallet-transactions", { page: 1, limit: 25, memberNumber: "MLM000002" }),
      getReportPage("withdrawals", { page: 1, limit: 25, memberNumber: "MLM000002" }),
      getReportPage("sales", { page: 1, limit: 25, memberNumber: "MLM000003" }),
      getReportPage("orders", { page: 1, limit: 25, memberNumber: "MLM000003" }),
      getReportPage("members", { page: 1, limit: 25, memberNumber: "MLM000003" }),
      getReportPage("referrals", { page: 1, limit: 25, memberNumber: "MLM000002" }),
    ]);
    assert.equal(withdrawalDetail.status, "COMPLETED");
    assert.equal(withdrawalDetail.paymentReference, "E2E-PAYOUT-001");
    assert.equal(withdrawalDetail.wallet?.availableMinor, "500");
    assert.equal(ledgerPage.pagination.total, 4, "Wallet Ledger must include each of B's immutable movements");
    assert.equal(memberBTransactions.total, 4, "Member wallet history must agree with the platform ledger");
    const commissionCreditMinor = ledgerPage.items
      .filter((entry) => entry.type === "DIRECT_COMMISSION" || entry.type === "LEVEL_COMMISSION")
      .reduce((total, entry) => total + BigInt(entry.amountMinor), 0n);
    const completedWithdrawalEntry = ledgerPage.items.find((entry) => entry.type === "WITHDRAWAL");
    assert.equal(commissionCreditMinor, 1_500n, "B's ledger commission credits must equal the two CommissionTransactions");
    assert.equal(completedWithdrawalEntry?.amountMinor, "1000", "The ledger must record the completed payout exactly once");
    assert.equal(BigInt(withdrawalDetail.wallet?.availableMinor ?? "0"), commissionCreditMinor - BigInt(completedWithdrawalEntry?.amountMinor ?? "0"), "Wallet available balance must reconcile with B's immutable ledger");
    assert.equal(memberDashboard.metrics.availableBalanceMinor, "500");
    assert.equal(memberDashboard.metrics.lifetimeEarningsMinor, "1500");
    assert.equal(memberDashboard.metrics.directReferrals, 1);
    assert.equal(ordersPage.total, 2, "Member order history must include the settled order and the later pending-payment order");
    assert.ok(ordersPage.orders.some((entry) => entry.paymentStatus === "SUCCESS"), "Member order history must include the paid order");
    assert.equal(commissionReport.pagination.total, 2);
    assert.equal(walletReport.pagination.total, 4);
    assert.equal(withdrawalReport.pagination.total, 1);
    assert.equal(withdrawalReport.items[0]?.status, "COMPLETED");
    assert.equal(salesReport.pagination.total, 1);
    assert.equal(ordersReport.pagination.total, 2);
    assert.equal(memberReport.pagination.total, 1);
    assert.ok(referralReport.items.some((row) => row.memberNumber === "MLM000003" && row.sponsorMemberNumber === "MLM000002"), "Referral reports must use the same B → C relationship as Genealogy");

    const adminDashboard = await DashboardService.getAdminDashboard(parseAdminDashboardRange(new URLSearchParams({ range: "30d" })));
    assert.equal(adminDashboard.metrics.totalMembers, 3);
    assert.equal(adminDashboard.metrics.activeMembers, 3);
    assert.equal(adminDashboard.metrics.totalOrders, 2);
    assert.equal(adminDashboard.metrics.successfulPayments, 1);
    assert.equal(adminDashboard.metrics.totalSalesMinor, "10005");
    assert.equal(adminDashboard.metrics.totalCommissionMinor, "1700");
    assert.equal(adminDashboard.metrics.walletLiabilityMinor, "700");
    assert.equal(adminDashboard.metrics.completedWithdrawalCount, 1);
    assert.equal(adminDashboard.metrics.completedWithdrawalsMinor, "1000");
    assert.ok(adminDashboard.recentOrders.some((entry) => entry.id === checkout.orderId));
    assert.ok(adminDashboard.recentPayments.some((entry) => entry.id === String(payment._id)));
    assert.ok(adminDashboard.recentCommissions.some((entry) => entry.memberNumber === "MLM000002"));
    assert.ok(adminDashboard.securityActivity.some((entry) => entry.action === "withdrawal.status_changed"));
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
