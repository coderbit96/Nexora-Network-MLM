import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth/authorization";
import { encryptSensitiveField } from "@/lib/security/field-encryption";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { paymentDetailsSchema } from "@/lib/validation/member";
import { parseJsonBody } from "@/lib/validation/request";
import { MemberPaymentDetails } from "@/models";
import { getMaskedPaymentDetails, getMemberProfileByUserId } from "@/services/members/member-profile";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requireAuth(request);
  const profile = await getMemberProfileByUserId(context.user._id);
  return apiSuccess(await getMaskedPaymentDetails(profile._id));
});

export const PUT = withApiErrorHandling(async (request: Request) => {
  const context = await requireAuth(request);
  enforceRateLimit(`payment-details:${context.userId}:${request.headers.get("x-forwarded-for") ?? "unknown"}`, 10, 60_000);
  const input = await parseJsonBody(request, paymentDetailsSchema);
  const profile = await getMemberProfileByUserId(context.user._id);
  await MemberPaymentDetails.findOneAndUpdate({ memberProfileId: profile._id }, { $set: { accountHolderNameEncrypted: encryptSensitiveField(input.accountHolderName), bankNameEncrypted: encryptSensitiveField(input.bankName), accountNumberEncrypted: encryptSensitiveField(input.accountNumber), ifscCodeEncrypted: encryptSensitiveField(input.ifscCode), accountLast4: input.accountNumber.slice(-4) } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  return apiSuccess(await getMaskedPaymentDetails(profile._id));
});
