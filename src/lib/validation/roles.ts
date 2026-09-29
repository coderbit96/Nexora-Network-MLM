import { z } from "zod";

import { isPermissionKey } from "@/config/permissions";

const permissionKeysSchema = z.array(z.string().refine(isPermissionKey, "Unknown permission key.")).max(100).transform((keys) => [...new Set(keys)]);
const roleNameSchema = z.string().trim().min(2, "Enter a role name.").max(120)
  .refine((name) => !["SUPER_ADMIN", "ADMIN", "STAFF", "MEMBER"].includes(name), "Base role names are reserved for system roles.");
const roleSlugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only.").max(100);
const customBaseRoleSchema = z.enum(["ADMIN", "STAFF", "MEMBER"]);

export const createRoleSchema = z.object({
  name: roleNameSchema,
  slug: roleSlugSchema,
  description: z.string().trim().max(500).optional().transform((value) => value || undefined),
  baseRole: customBaseRoleSchema,
  permissions: permissionKeysSchema,
  isActive: z.boolean().default(true),
});

export const updateRoleSchema = z.object({
  name: roleNameSchema.optional(),
  slug: roleSlugSchema.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  baseRole: customBaseRoleSchema.optional(),
  permissions: permissionKeysSchema.optional(),
  isActive: z.boolean().optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
