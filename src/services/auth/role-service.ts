import "server-only";

import { startSession, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import type { AuditRequestContext } from "@/services/audit/audit-service";
import { AuditService } from "@/services/audit/audit-service";
import { Role, User } from "@/models";
import type { CreateRoleInput, UpdateRoleInput } from "@/lib/validation/roles";
import { hasPermission, type AuthorizationSnapshot } from "@/lib/auth/policy";
import { PERMISSION } from "@/config/permissions";
import { canCreateRoleDefinition, canManageRoleDefinition } from "./role-authorization";

type AuditInput = AuditRequestContext & { actorUserId: Types.ObjectId; actor: AuthorizationSnapshot };

function roleSnapshot(role: { name: string; slug: string; description?: string; baseRole: string; permissions: readonly string[]; isSystem: boolean; isActive: boolean }) {
  return { name: role.name, slug: role.slug, description: role.description ?? null, baseRole: role.baseRole, permissions: [...role.permissions], isSystem: role.isSystem, isActive: role.isActive };
}

export class RoleService {
  static async create(input: CreateRoleInput, audit: AuditInput) {
    if (!canCreateRoleDefinition(audit.actor, input)) throw errors.forbidden();
    await connectToDatabase();
    const session = await startSession();
    try {
      let createdId: string | undefined;
      await session.withTransaction(async () => {
        const duplicate = await Role.exists({ $or: [{ slug: input.slug }, { name: input.name }] }).session(session);
        if (duplicate) throw errors.conflict("A role with that name or slug already exists.");
        const [role] = await Role.create([{
          name: input.name,
          slug: input.slug,
          ...(input.description ? { description: input.description } : {}),
          baseRole: input.baseRole,
          permissions: input.permissions,
          isSystem: false,
          isActive: input.isActive,
        }], { session });
        createdId = String(role._id);
        await AuditService.record({ ...audit, action: "role.created", resourceType: "Role", resourceId: createdId, after: roleSnapshot(role) }, session);
      });
      if (!createdId) throw new Error("Role creation did not complete.");
      return { id: createdId };
    } finally {
      await session.endSession();
    }
  }

  static async update(roleId: string, input: UpdateRoleInput, audit: AuditInput) {
    if (!hasPermission(audit.actor, PERMISSION.ROLES.EDIT)) throw errors.forbidden();
    await connectToDatabase();
    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        const role = await Role.findById(roleId).session(session);
        if (!role) throw errors.notFound("Role was not found.");
        if (!canManageRoleDefinition(audit.actor, role)
          || !canManageRoleDefinition(audit.actor, { baseRole: input.baseRole ?? role.baseRole, permissions: input.permissions ?? role.permissions, isSystem: role.isSystem })) {
          throw errors.forbidden("You cannot manage this role or grant these permissions.");
        }
        const before = roleSnapshot(role);

        if (role.isSystem) {
          if (input.name !== undefined || input.slug !== undefined || input.baseRole !== undefined) {
            throw errors.conflict("System role identity cannot be changed.");
          }
          if (input.isActive !== undefined) {
            if (role.baseRole === "SUPER_ADMIN") {
              throw errors.conflict("The SUPER_ADMIN system role must remain active.");
            }
            if (!audit.actor.roles.includes("SUPER_ADMIN")) {
              throw errors.forbidden("Only a Super Admin can change a built-in role's status.");
            }
            role.isActive = input.isActive;
          }
          if (role.baseRole === "SUPER_ADMIN" && input.permissions && input.permissions.length) {
            throw errors.badRequest("SUPER_ADMIN access is implicit and cannot store permissions.");
          }
        } else {
          if (input.name !== undefined && input.name !== role.name) {
            const duplicate = await Role.exists({ name: input.name, _id: { $ne: role._id } }).session(session);
            if (duplicate) throw errors.conflict("A role with that name already exists.");
            role.name = input.name;
          }
          if (input.slug !== undefined && input.slug !== role.slug) {
            throw errors.conflict("A role slug is permanent once created.");
          }
          if (input.baseRole !== undefined) role.baseRole = input.baseRole;
          if (input.isActive !== undefined) role.isActive = input.isActive;
        }
        if (input.description !== undefined) role.description = input.description ?? undefined;
        if (input.permissions !== undefined) role.permissions = input.permissions;
        await role.save({ session });
        await AuditService.record({ ...audit, action: "role.updated", resourceType: "Role", resourceId: roleId, before, after: roleSnapshot(role) }, session);
      });
    } finally {
      await session.endSession();
    }
  }

  static async remove(roleId: string, audit: AuditInput) {
    if (!hasPermission(audit.actor, PERMISSION.ROLES.DELETE)) throw errors.forbidden();
    await connectToDatabase();
    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        const role = await Role.findById(roleId).session(session);
        if (!role) throw errors.notFound("Role was not found.");
        if (!canManageRoleDefinition(audit.actor, role)) throw errors.forbidden();
        if (role.isSystem) throw errors.conflict("System roles cannot be deleted.");
        if (await User.exists({ roleIds: role._id }).session(session)) {
          throw errors.conflict("This role is assigned to users. Reassign those users before deleting it.");
        }
        const before = roleSnapshot(role);
        await Role.deleteOne({ _id: role._id, isSystem: false }).session(session);
        await AuditService.record({ ...audit, action: "role.deleted", resourceType: "Role", resourceId: roleId, before }, session);
      });
    } finally {
      await session.endSession();
    }
  }
}
