import { type ClientSession, type Model, model, models, Schema, type Types } from "mongoose";

import type { IUser } from "@/types/domain";
import { Role } from "./role";
import { schemaOptions } from "./model-utils";

async function assertRolesAreAssignable(roleIds: Types.ObjectId[], session?: ClientSession | null) {
  const uniqueRoleIds = [...new Set(roleIds.map(String))];
  if (uniqueRoleIds.length === 0) throw new Error("At least one active application role is required.");
  const query = Role.countDocuments({ _id: { $in: uniqueRoleIds }, isActive: true });
  if (session) query.session(session);
  if (await query !== uniqueRoleIds.length) throw new Error("Roles must exist and be active before they can be assigned.");
}

const UserSchema = new Schema<IUser>({
  firebaseUid: { type: String, required: true, trim: true, immutable: true },
  email: { type: String, required: true, trim: true, lowercase: true, immutable: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  status: { type: String, required: true, enum: ["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"], default: "PENDING", index: true },
  roleIds: [{ type: Schema.Types.ObjectId, ref: "Role", required: true }],
  lastLoginAt: { type: Date },
}, schemaOptions);

// The related MemberProfile owns member-specific data. Its unique `userId`
// reference is the one-to-one link, avoiding a second mutable cross-reference
// on the application identity document.

UserSchema.index({ firebaseUid: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ status: 1, createdAt: -1 });
// Supports staff/role-management queries without scanning the member population.
UserSchema.index({ roleIds: 1, createdAt: -1 });

UserSchema.pre("validate", async function () {
  if (this.isModified("roleIds")) await assertRolesAreAssignable(this.roleIds, this.$session());
});

UserSchema.pre(["updateOne", "findOneAndUpdate", "replaceOne"], async function () {
  const update = this.getUpdate() as Record<string, unknown> | undefined;
  const roleIds = (update?.$set as Record<string, unknown> | undefined)?.roleIds
    ?? update?.roleIds
    ?? (update?.$addToSet as Record<string, unknown> | undefined)?.roleIds
    ?? (update?.$push as Record<string, unknown> | undefined)?.roleIds;
  if (Array.isArray(roleIds)) await assertRolesAreAssignable(roleIds as Types.ObjectId[], this.getOptions().session);
  if (roleIds && !Array.isArray(roleIds)) {
    const values = typeof roleIds === "object" && "$each" in roleIds
      ? (roleIds as { $each?: unknown }).$each
      : [roleIds];
    if (!Array.isArray(values)) throw new Error("Role assignment must use valid role identifiers.");
    await assertRolesAreAssignable(values as Types.ObjectId[], this.getOptions().session);
  }
});

UserSchema.pre("updateMany", function () {
  const update = this.getUpdate() as Record<string, unknown> | undefined;
  if (update?.roleIds || (update?.$set as Record<string, unknown> | undefined)?.roleIds || (update?.$addToSet as Record<string, unknown> | undefined)?.roleIds || (update?.$push as Record<string, unknown> | undefined)?.roleIds) {
    throw new Error("Bulk role assignment is not permitted.");
  }
});

export const User: Model<IUser> = (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
