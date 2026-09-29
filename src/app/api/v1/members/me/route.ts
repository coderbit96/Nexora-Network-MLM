import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth/authorization";
import { parseJsonBody } from "@/lib/validation/request";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { updateMemberProfileSchema } from "@/lib/validation/member";
import { MemberProfile, User } from "@/models";
import { getMaskedPaymentDetails, getMemberProfileByUserId } from "@/services/members/member-profile";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requireAuth(request);
  const profile = await getMemberProfileByUserId(context.user._id);
  const paymentDetails = await getMaskedPaymentDetails(profile._id);
  return apiSuccess({ user: { email: context.user.email, displayName: context.user.displayName, status: context.status }, profile, paymentDetails });
});

export const PATCH = withApiErrorHandling(async (request: Request) => {
  const context = await requireAuth(request);
  enforceRateLimit(`member-profile:${context.userId}:${request.headers.get("x-forwarded-for") ?? "unknown"}`, 20, 60_000);
  const input = await parseJsonBody(request, updateMemberProfileSchema);
  const profile = await MemberProfile.findOneAndUpdate({ userId: context.user._id }, { $set: { firstName: input.firstName, lastName: input.lastName, phone: input.phone || undefined, alternatePhone: input.alternatePhone || undefined, address: input.address ?? undefined } }, { returnDocument: "after", runValidators: true });
  if (!profile) throw new Error("Member profile was not found.");
  await User.updateOne({ _id: context.user._id }, { $set: { displayName: `${input.firstName} ${input.lastName}`.trim() } });
  return apiSuccess({ profile });
});
