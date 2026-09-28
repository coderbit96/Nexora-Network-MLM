import type { Types } from "mongoose";
import type { PermissionKey } from "@/config/permissions";

export type ObjectId = Types.ObjectId;
export type Timestamped = { createdAt: Date; updatedAt: Date };
export type AccountStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DISABLED";
export type ApplicationRoleName = "SUPER_ADMIN" | "ADMIN" | "STAFF" | "MEMBER";
export type MemberActivationStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type CommissionType = "DIRECT" | "LEVEL";
export type CommissionCalculationBasis = "ORDER_SUBTOTAL" | "ORDER_TOTAL" | "PV" | "BV";
export type CommissionRewardType = "PERCENTAGE" | "FIXED";
export type CommissionStatus = "PENDING" | "APPROVED" | "REVERSED" | "VOID";
export type WalletTransactionType = "DIRECT_COMMISSION" | "LEVEL_COMMISSION" | "WITHDRAWAL_RESERVATION" | "WITHDRAWAL" | "WITHDRAWAL_RELEASE" | "WITHDRAWAL_REVERSAL" | "ADMIN_CREDIT" | "ADMIN_DEBIT" | "ORDER_REFUND_ADJUSTMENT" | "OTHER";
export type LedgerDirection = "CREDIT" | "DEBIT";
export type WithdrawalStatus = "PENDING" | "APPROVED" | "PROCESSING" | "COMPLETED" | "REJECTED" | "CANCELLED";
export type ProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type OrderStatus = "PENDING" | "PAYMENT_PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
export type CommissionProcessingStatus = "NOT_ELIGIBLE" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REVERSED";
export type PaymentStatus = "CREATED" | "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
export type NotificationType = "SYSTEM" | "ACCOUNT" | "ORDER" | "COMMISSION" | "WALLET" | "WITHDRAWAL";

export interface IUser extends Timestamped { firebaseUid: string; email: string; displayName: string; status: AccountStatus; roleIds: ObjectId[]; lastLoginAt?: Date; }
export interface IAddress { line1: string; line2?: string; city: string; state: string; postalCode: string; country: string; }
export interface IMemberProfile extends Timestamped { userId: ObjectId; memberNumber: string; referralCode: string; firstName: string; lastName: string; phone?: string; alternatePhone?: string; address?: IAddress; activationStatus: MemberActivationStatus; joinedAt: Date; }
export interface IMemberPaymentDetails extends Timestamped { memberProfileId: ObjectId; accountHolderNameEncrypted: string; bankNameEncrypted: string; accountNumberEncrypted: string; ifscCodeEncrypted: string; accountLast4: string; }
export interface ISponsorRelationship extends Timestamped { memberProfileId: ObjectId; sponsorMemberProfileId: ObjectId; uplineMemberProfileIds: ObjectId[]; }
export interface IPlacement extends Timestamped { memberProfileId: ObjectId; parentMemberProfileId?: ObjectId; ancestorMemberProfileIds: ObjectId[]; }
export interface ICommissionRule extends Timestamped { name: string; commissionType: CommissionType; level?: number; calculationBasis: CommissionCalculationBasis; rewardType: CommissionRewardType; rateBasisPoints?: number; fixedAmountMinor?: bigint; active: boolean; effectiveFrom: Date; effectiveTo?: Date; }
export interface ICommissionTransaction extends Timestamped { recipientMemberProfileId: ObjectId; sourceMemberProfileId: ObjectId; sourceReferenceType: "ORDER"; sourceReferenceId: string; sourceOrderId?: ObjectId; commissionRuleId: ObjectId; ruleEffectiveFrom: Date; commissionType: CommissionType; level?: number; calculationBasis: CommissionCalculationBasis; rewardType: CommissionRewardType; rateBasisPoints?: number; fixedAmountMinor?: bigint; currency: string; baseAmountMinor: bigint; amountMinor: bigint; status: CommissionStatus; walletTransactionId?: ObjectId; }
export interface IWallet extends Timestamped { memberProfileId: ObjectId; currency: string; availableMinor: bigint; heldMinor: bigint; lifetimeCreditMinor: bigint; lifetimeDebitMinor: bigint; lifetimeEarningsMinor: bigint; lifetimeWithdrawalsMinor: bigint; }
export interface IWalletTransaction extends Timestamped { walletId: ObjectId; memberProfileId: ObjectId; currency: string; type: WalletTransactionType; direction: LedgerDirection; amountMinor: bigint; resultingAvailableMinor: bigint; resultingHeldMinor: bigint; referenceType: string; referenceId: string; idempotencyKey: string; description: string; metadata?: Record<string, unknown>; }
export interface IWithdrawal extends Timestamped { memberProfileId: ObjectId; walletId: ObjectId; currency: string; amountMinor: bigint; status: WithdrawalStatus; idempotencyKey: string; destinationSnapshot: Record<string, unknown>; reviewedByUserId?: ObjectId; reviewedAt?: Date; completedAt?: Date; paymentReference?: string; statusHistory: Array<{ status: WithdrawalStatus; changedAt: Date; changedByUserId?: ObjectId; note?: string; paymentReference?: string }>; }
export interface ICategory extends Timestamped { name: string; slug: string; description?: string; status: "ACTIVE" | "INACTIVE"; }
export interface IOrderItem { productId: ObjectId; sku: string; name: string; quantity: number; unitPriceMinor: bigint; lineTotalMinor: bigint; pv: bigint; bv: bigint; commissionEligible: boolean; }
export interface IProduct extends Timestamped { categoryId: ObjectId; name: string; slug: string; sku: string; shortDescription?: string; description?: string; imageUrls: string[]; priceMinor: bigint; salePriceMinor?: bigint; currency: string; pv: bigint; bv: bigint; stockQuantity: number; commissionEligible: boolean; featured: boolean; status: ProductStatus; }
export interface ICart extends Timestamped { memberProfileId: ObjectId; items: Array<{ productId: ObjectId; quantity: number }>; }
export interface IOrder extends Timestamped { orderNumber: string; memberProfileId: ObjectId; currency: string; items: IOrderItem[]; subtotalMinor: bigint; discountMinor: bigint; taxMinor: bigint; totalMinor: bigint; status: OrderStatus; paymentStatus: PaymentStatus; commissionStatus: CommissionProcessingStatus; checkoutIdempotencyKey: string; paidAt?: Date; }
export interface IPayment extends Timestamped { orderId: ObjectId; provider: string; providerTransactionId?: string; amountMinor: bigint; currency: string; status: PaymentStatus; idempotencyKey: string; providerPayload?: Record<string, unknown>; }
export interface IPaymentWebhookEvent extends Timestamped { provider: string; eventId: string; paymentId?: ObjectId; status: "RECEIVED" | "PROCESSED" | "FAILED"; payloadHash: string; processedAt?: Date; }
export interface INotification extends Timestamped { userId: ObjectId; type: NotificationType; title: string; body: string; readAt?: Date; actionUrl?: string; metadata?: Record<string, unknown>; }
export interface IPermission extends Timestamped { key: string; name: string; description?: string; module: string; }
/**
 * Roles are application authorization records. Permission keys are stored
 * directly so resolving a request does not require a second permissions join.
 * `baseRole` provides the coarse application boundary for custom roles.
 */
export interface IRole extends Timestamped {
  name: string;
  slug: string;
  description?: string;
  baseRole: ApplicationRoleName;
  permissions: PermissionKey[];
  isSystem: boolean;
  isActive: boolean;
}
export interface ISystemCounter { _id: string; sequence: number; createdAt: Date; updatedAt: Date; }
export interface IAuditLog extends Timestamped { actorUserId?: ObjectId; action: string; resourceType: string; resourceId?: string; ipAddress?: string; userAgent?: string; before?: Record<string, unknown>; after?: Record<string, unknown>; metadata?: Record<string, unknown>; }
export interface ISetting extends Timestamped { key: string; value: unknown; valueType: "STRING" | "NUMBER" | "BOOLEAN" | "JSON"; isSecret: boolean; updatedByUserId?: ObjectId; }
