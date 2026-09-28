import "server-only";

import { type ClientSession, startSession, Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { getFirebaseAdminAuth } from "@/lib/auth/firebase-admin";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { AuthContext } from "@/lib/auth/authorization";
import type { CreateStaffInput, UpdateStaffInput } from "@/lib/validation/staff";
import { Role, User } from "@/models";
import { AuditService, type AuditRequestContext } from "@/services/audit/audit-service";
import {
  canApplyStaffStatus,
  canAssignStaffRole,
  canAssignStaffRoles,
  canCreateStaff,
  canEditStaff,
  canManageStaffTarget,
  type AssignableStaffRole,
} from "@/services/auth/staff-authorization";

type StaffAuditInput = AuditRequestContext & { actorUserId: Types.ObjectId };

function roleSnapshot(role: AssignableStaffRole) {
  return { id: String(role._id), name: role.name, slug: role.slug, baseRole: role.baseRole };
}

function staffSnapshot(user: { displayName: string; email: string; status: string }, role: AssignableStaffRole) {
  return { name: user.displayName, email: user.email, status: user.status, role: roleSnapshot(role) };
}

function firebaseError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "auth/email-already-exists") return errors.conflict("A Firebase account already exists for this email address.");
  if (code === "auth/user-not-found") return errors.conflict("The linked Firebase identity is unavailable.");
  if (error instanceof Error && error.name === "ZodError") return error;
  return errors.conflict("The Firebase identity could not be synchronized.");
}

async function loadAssignableRole(roleId: string, actor: AuthContext, session?: ClientSession) {
  const query = Role.findById(roleId).select("name slug baseRole permissions isActive");
  if (session) query.session(session);
  const role = await query.lean();
  if (!role || !canAssignStaffRole(actor, role)) throw errors.forbidden();
  return role as AssignableStaffRole;
}

async function loadTargetRoles(roleIds: Types.ObjectId[], session: ClientSession) {
  return Role.find({ _id: { $in: roleIds } }).select("baseRole").session(session).lean();
}

function assertTargetIsStaff(targetRoles: readonly Pick<AssignableStaffRole, "baseRole">[]) {
  if (!targetRoles.some((role) => ["SUPER_ADMIN", "ADMIN", "STAFF"].includes(role.baseRole))) {
    throw errors.notFound("Staff account was not found.");
  }
}

export class StaffService {
  static async listAssignableRoles(actor: AuthContext) {
    if (!canCreateStaff(actor) && !(canEditStaff(actor) && canAssignStaffRoles(actor))) return [];
    await connectToDatabase();
    const roles = await Role.find({ isActive: true, baseRole: { $in: ["ADMIN", "STAFF"] } })
      .select("name slug baseRole permissions isActive")
      .sort({ name: 1 })
      .lean();
    return roles.filter((role) => canAssignStaffRole(actor, role as AssignableStaffRole));
  }

  static async create(input: CreateStaffInput, actor: AuthContext, audit: StaffAuditInput) {
    if (!canCreateStaff(actor)) throw errors.forbidden();
    await connectToDatabase();
    await loadAssignableRole(input.roleId, actor);
    const duplicate = await User.exists({ email: input.email });
    if (duplicate) throw errors.conflict("An application account already exists for this email address.");

    let firebaseUid: string | undefined;
    try {
      const firebaseUser = await getFirebaseAdminAuth().createUser({
        email: input.email,
        password: input.password,
        displayName: input.name,
        disabled: input.status === "DISABLED",
      });
      firebaseUid = firebaseUser.uid;

      const session = await startSession();
      try {
        let createdId: string | undefined;
        await session.withTransaction(async () => {
          if (await User.exists({ email: input.email }).session(session)) throw errors.conflict("An application account already exists for this email address.");
          const assignedRole = await loadAssignableRole(input.roleId, actor, session);
          const [user] = await User.create([{
            firebaseUid: firebaseUser.uid,
            email: input.email,
            displayName: input.name,
            status: input.status,
            roleIds: [assignedRole._id],
          }], { session });
          createdId = String(user._id);
          await AuditService.record({ ...audit, action: "staff.created", resourceType: "User", resourceId: createdId, after: staffSnapshot(user, assignedRole) }, session);
        });
        if (!createdId) throw new Error("Staff account was not created.");
        return { id: createdId };
      } finally {
        await session.endSession();
      }
    } catch (error) {
      if (firebaseUid) {
        try { await getFirebaseAdminAuth().deleteUser(firebaseUid); } catch { /* Reconciliation can safely remove an orphaned identity. */ }
      }
      if (error instanceof Error && error.name === "AppError") throw error;
      throw firebaseError(error);
    }
  }

  static async update(staffId: string, input: UpdateStaffInput, actor: AuthContext, audit: StaffAuditInput) {
    await connectToDatabase();
    const existing = await User.findById(staffId).lean();
    if (!existing) throw errors.notFound("Staff account was not found.");
    const existingRoles = await Role.find({ _id: { $in: existing.roleIds } }).select("baseRole").lean();
    assertTargetIsStaff(existingRoles);
    if (!canManageStaffTarget(actor, actor.userId, String(existing._id), existingRoles)) throw errors.forbidden();
    if (input.name !== undefined && !canEditStaff(actor)) throw errors.forbidden();
    if (input.status !== undefined && !canApplyStaffStatus(actor, input.status)) throw errors.forbidden();
    if (input.roleId !== undefined) {
      if (!canEditStaff(actor)) throw errors.forbidden();
      await loadAssignableRole(input.roleId, actor);
    }

    const firebaseChanges: { displayName?: string; disabled?: boolean } = {};
    if (input.name !== undefined) firebaseChanges.displayName = input.name;
    if (input.status !== undefined) firebaseChanges.disabled = input.status === "DISABLED";
    if (Object.keys(firebaseChanges).length) {
      try { await getFirebaseAdminAuth().updateUser(existing.firebaseUid, firebaseChanges); }
      catch (error) { throw firebaseError(error); }
    }

    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        const user = await User.findById(staffId).session(session);
        if (!user) throw errors.notFound("Staff account was not found.");
        const targetRoles = await loadTargetRoles(user.roleIds, session);
        assertTargetIsStaff(targetRoles);
        if (!canManageStaffTarget(actor, actor.userId, String(user._id), targetRoles)) throw errors.forbidden();
        const currentRole = await Role.findById(user.roleIds[0]).select("name slug baseRole permissions isActive").session(session).lean();
        if (!currentRole) throw errors.conflict("The current staff role is unavailable.");
        const before = staffSnapshot(user, currentRole as AssignableStaffRole);
        const events: Array<{ action: string; before?: Record<string, unknown>; after?: Record<string, unknown> }> = [];

        if (input.name !== undefined && input.name !== user.displayName) {
          user.displayName = input.name;
          events.push({ action: "staff.updated", before: { name: before.name }, after: { name: input.name } });
        }
        if (input.roleId !== undefined && String(user.roleIds[0]) !== input.roleId) {
          const nextRole = await loadAssignableRole(input.roleId, actor, session);
          user.roleIds = [nextRole._id];
          events.push({ action: "staff.role_changed", before: { role: before.role }, after: { role: roleSnapshot(nextRole) } });
        }
        if (input.status !== undefined && input.status !== user.status) {
          const previousStatus = user.status;
          user.status = input.status;
          const action = input.status === "ACTIVE" ? "staff.activated" : input.status === "SUSPENDED" ? "staff.suspended" : input.status === "DISABLED" ? "staff.disabled" : "staff.status_changed";
          events.push({ action, before: { status: previousStatus }, after: { status: input.status } });
        }
        if (!events.length) return;
        await user.save({ session });
        for (const event of events) {
          await AuditService.record({ ...audit, action: event.action, resourceType: "User", resourceId: String(user._id), before: event.before, after: event.after }, session);
        }
      });
    } catch (error) {
      // Firebase is outside MongoDB's transaction. Restore its previous state
      // if MongoDB rejects the mutation, leaving access in the safer prior state.
      if (Object.keys(firebaseChanges).length) {
        try {
          await getFirebaseAdminAuth().updateUser(existing.firebaseUid, {
            ...(input.name !== undefined ? { displayName: existing.displayName } : {}),
            ...(input.status !== undefined ? { disabled: existing.status === "DISABLED" } : {}),
          });
        } catch { /* A failed rollback is availability-affecting, not an authorization grant; alert via operations monitoring. */ }
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
