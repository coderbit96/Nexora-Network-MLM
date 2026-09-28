import { type Model, model, models, type Query, Schema } from "mongoose";

import { APPLICATION_ROLES, isPermissionKey, PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@/config/permissions";
import type { IRole } from "@/types/domain";
import { schemaOptions } from "./model-utils";

const RoleSchema = new Schema<IRole>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  slug: { type: String, required: true, trim: true, lowercase: true, immutable: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  description: { type: String, trim: true, maxlength: 500 },
  baseRole: { type: String, required: true, enum: APPLICATION_ROLES },
  permissions: {
    type: [{ type: String, required: true, enum: PERMISSIONS }],
    default: [],
    validate: {
      validator: (permissions: unknown) => Array.isArray(permissions) && permissions.every(isPermissionKey),
      message: "Role permissions must be permission keys from the centralized catalog.",
    },
  },
  // Mongoose applies an immutable default while hydrating existing documents in
  // some versions, which prevents any update to a system role. Mutations are
  // instead rejected below for both document and query update paths.
  isSystem: { type: Boolean, required: true, default: false },
  isActive: { type: Boolean, required: true, default: true },
}, schemaOptions);

RoleSchema.pre("validate", function () {
  if (!this.isNew && this.isModified("isSystem")) {
    this.invalidate("isSystem", "The system-role flag cannot be changed.");
  }
  if (!this.isSystem) {
    if ((APPLICATION_ROLES as readonly string[]).includes(this.name)) {
      this.invalidate("name", "Base role names are reserved for system roles.");
    }
    if (this.baseRole === "SUPER_ADMIN") {
      this.invalidate("baseRole", "Only the SUPER_ADMIN system role may use the SUPER_ADMIN base role.");
    }
    return;
  }

  const expectedSlug = SYSTEM_ROLE_SLUGS[this.baseRole];
  if (this.name !== this.baseRole) this.invalidate("name", "System role names must match their base role.");
  if (this.slug !== expectedSlug) this.invalidate("slug", "System role slug does not match its base role.");
  if (this.baseRole === "SUPER_ADMIN" && !this.isActive) {
    this.invalidate("isActive", "The SUPER_ADMIN system role must remain active to preserve recovery access.");
  }
  if (this.baseRole === "SUPER_ADMIN" && this.permissions.length > 0) {
    this.invalidate("permissions", "SUPER_ADMIN permissions are granted implicitly and must not be persisted.");
  }
});

async function protectSystemRoleDeletion(this: Query<unknown, IRole>) {
  const systemRole = await this.model.exists({ ...this.getFilter(), isSystem: true });
  if (systemRole) throw new Error("System roles cannot be deleted.");
}

RoleSchema.pre("deleteOne", protectSystemRoleDeletion);
RoleSchema.pre("deleteMany", protectSystemRoleDeletion);
RoleSchema.pre("findOneAndDelete", protectSystemRoleDeletion);

RoleSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne"], async function () {
  const update = this.getUpdate() as Record<string, unknown> | undefined;
  const changes = (update?.$set ?? update ?? {}) as Record<string, unknown>;
  if (changes.isSystem !== undefined) throw new Error("The system-role flag cannot be changed.");
  const permissionValue = changes.permissions
    ?? (update?.$addToSet as Record<string, unknown> | undefined)?.permissions
    ?? (update?.$push as Record<string, unknown> | undefined)?.permissions;
  if (permissionValue !== undefined) {
    const values = Array.isArray(permissionValue)
      ? permissionValue
      : typeof permissionValue === "object" && permissionValue !== null && "$each" in permissionValue
        ? (permissionValue as { $each?: unknown }).$each
        : [permissionValue];
    if (!Array.isArray(values) || !values.every(isPermissionKey)) {
      throw new Error("Role permissions must be permission keys from the centralized catalog.");
    }
  }
  if (changes.isActive !== undefined) {
    const systemRole = await this.model.exists({ ...this.getFilter(), isSystem: true });
    if (systemRole) throw new Error("System role status must be changed through the authorized role service.");
  }
});

RoleSchema.index({ slug: 1 }, { unique: true });
RoleSchema.index({ name: 1 }, { unique: true });
RoleSchema.index({ baseRole: 1, isActive: 1 });
RoleSchema.index({ permissions: 1 });

// Next.js development hot reload can retain a previously compiled Mongoose
// model. Remove only the obsolete definition that used the old immutable
// `isSystem` field so a running dev server adopts the safe validation guards.
const cachedRole = models.Role as Model<IRole> | undefined;
if (cachedRole?.schema.path("isSystem")?.options.immutable === true) {
  delete models.Role;
}
export const Role: Model<IRole> = (models.Role as Model<IRole>) || model<IRole>("Role", RoleSchema);
