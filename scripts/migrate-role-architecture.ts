import { loadEnvConfig } from "@next/env";
import mongoose, { Types } from "mongoose";

loadEnvConfig(process.cwd());

import { APPLICATION_ROLES, isPermissionKey, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "../src/config/permissions";
import { Permission } from "../src/models/permission";

type LegacyRole = {
  _id: Types.ObjectId;
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  baseRole?: unknown;
  permissions?: unknown;
  permissionIds?: unknown;
  isSystem?: unknown;
  isActive?: unknown;
};

const asBaseRole = (value: unknown): (typeof APPLICATION_ROLES)[number] | undefined =>
  typeof value === "string" && (APPLICATION_ROLES as readonly string[]).includes(value) ? value as (typeof APPLICATION_ROLES)[number] : undefined;

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "custom-role";
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI must be set in .env.");
  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB_NAME || "mlm_platform",
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    const permissionKeysById = new Map(
      (await Permission.find().select("_id key").lean()).map((permission) => [String(permission._id), permission.key]),
    );
    const roles = await mongoose.connection.collection<LegacyRole>("roles").find({}).toArray();
    const usedSlugs = new Set<string>();

    for (const role of roles) {
      const name = typeof role.name === "string" && role.name.trim() ? role.name.trim() : "Custom role";
      const inferredBaseRole = asBaseRole(role.baseRole) ?? asBaseRole(name) ?? "STAFF";
      // Legacy schemas only allowed the four base names. A malformed custom
      // record must never become a protected system record during migration.
      const isSystem = asBaseRole(name) !== undefined;
      const validStoredPermissions = Array.isArray(role.permissions) ? role.permissions.filter(isPermissionKey) : [];
      const legacyPermissions = Array.isArray(role.permissionIds)
        ? role.permissionIds.map((id) => permissionKeysById.get(String(id))).filter(isPermissionKey)
        : [];
      const permissions = isSystem && inferredBaseRole === "SUPER_ADMIN"
        ? []
        : [...new Set([...validStoredPermissions, ...legacyPermissions])];

      const requestedSlug = isSystem ? SYSTEM_ROLE_SLUGS[inferredBaseRole] : typeof role.slug === "string" ? toSlug(role.slug) : toSlug(name);
      let slug = requestedSlug;
      let suffix = 2;
      while (usedSlugs.has(slug)) slug = `${requestedSlug}-${suffix++}`;
      usedSlugs.add(slug);

      await mongoose.connection.collection("roles").updateOne(
        { _id: role._id },
        {
          $set: {
            name: isSystem ? inferredBaseRole : name,
            slug,
            description: typeof role.description === "string" ? role.description.trim().slice(0, 500) : undefined,
            baseRole: inferredBaseRole,
            permissions: isSystem && inferredBaseRole !== "SUPER_ADMIN" && permissions.length === 0
              ? SYSTEM_ROLE_PERMISSIONS[inferredBaseRole]
              : permissions,
            isSystem,
            isActive: role.isActive !== false,
          },
          $unset: { permissionIds: "" },
        },
      );
    }

    console.log(`Migrated ${roles.length} role records to key-based permissions.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(() => {
  console.error("Role migration failed. Check protected deployment logs for diagnostics.");
  process.exit(1);
});
