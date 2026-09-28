import "server-only";

import type { ClientSession } from "mongoose";

import { APPLICATION_ROLES, PERMISSION_CATALOG, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@/config/permissions";
import { Permission, Role } from "@/models";
import type { ApplicationRoleName } from "@/types/domain";

export async function ensureSystemRbac(session?: ClientSession) {
  await Permission.bulkWrite(PERMISSION_CATALOG.map((definition) => ({ updateOne: { filter: { key: definition.key }, update: { $setOnInsert: { key: definition.key, name: definition.label, description: definition.description, module: definition.category.toLowerCase() } }, upsert: true } })), { session });
  for (const roleName of APPLICATION_ROLES) {
    await Role.updateOne(
      { name: roleName },
      {
        $setOnInsert: {
          name: roleName,
          slug: SYSTEM_ROLE_SLUGS[roleName],
          baseRole: roleName,
          permissions: SYSTEM_ROLE_PERMISSIONS[roleName],
          isSystem: true,
          isActive: true,
          description: `${roleName} system role`,
        },
      },
      { upsert: true, session },
    );

    // Defaults apply only on first creation. Registration must never restore
    // permissions deliberately revoked by an administrator.
  }
}

export async function getRoleId(roleName: ApplicationRoleName, session?: ClientSession) {
  const roleQuery = Role.findOne({ name: roleName, baseRole: roleName, isSystem: true, isActive: true });
  if (session) roleQuery.session(session);
  const role = await roleQuery.lean();
  if (!role) throw new Error(`Required ${roleName} role is not initialized.`);
  return role._id;
}
