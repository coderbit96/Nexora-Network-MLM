import { loadEnvConfig } from "@next/env";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import mongoose, { startSession } from "mongoose";

loadEnvConfig(process.cwd());

import { APPLICATION_ROLES, PERMISSION_CATALOG, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "../src/config/permissions";
import { Permission } from "../src/models/permission";
import { Role } from "../src/models/role";
import { User } from "../src/models/user";
import { isStrongPassword } from "../src/lib/validation/password";

function requireEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set in .env.`);
  return value;
}

function getAdminAuth() {
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: requireEnvironment("FIREBASE_ADMIN_PROJECT_ID"),
          clientEmail: requireEnvironment("FIREBASE_ADMIN_CLIENT_EMAIL"),
          privateKey: requireEnvironment("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
        }),
      });
  return getAuth(app);
}

async function ensureSystemRbac(session: mongoose.ClientSession) {
  await Permission.bulkWrite(
    PERMISSION_CATALOG.map((definition) => ({
      updateOne: {
        filter: { key: definition.key },
        update: { $setOnInsert: { key: definition.key, name: definition.label, description: definition.description, module: definition.category.toLowerCase() } },
        upsert: true,
      },
    })),
    { session },
  );

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
  }
}

async function getOrCreateFirebaseAdministrator(email: string, password: string) {
  const auth = getAdminAuth();

  try {
    const existing = await auth.getUserByEmail(email);
    return auth.updateUser(existing.uid, { displayName: "Nexora Administrator", emailVerified: true });
  } catch (error: unknown) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found")) throw error;
    if (!isStrongPassword(password)) throw new Error("INITIAL_ADMIN_PASSWORD must use at least 12 characters with uppercase, lowercase, and a number when creating an administrator.");
    return auth.createUser({ email, password, displayName: "Nexora Administrator", emailVerified: true });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Administrator seeding is prohibited in production.");
  const email = requireEnvironment("INITIAL_ADMIN_EMAIL").toLowerCase();
  const password = requireEnvironment("INITIAL_ADMIN_PASSWORD");
  const firebaseUser = await getOrCreateFirebaseAdministrator(email, password);
  await mongoose.connect(requireEnvironment("MONGODB_URI"), {
    dbName: process.env.MONGODB_DB_NAME || "mlm_platform",
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  });

  const session = await startSession();
  try {
    await session.withTransaction(async () => {
      await ensureSystemRbac(session);
      const adminRole = await Role.findOne({ name: "SUPER_ADMIN" }).session(session).lean();
      if (!adminRole) throw new Error("Required SUPER_ADMIN role could not be initialized.");
      const emailOwner = await User.findOne({ email }).session(session).lean();

      if (emailOwner && emailOwner.firebaseUid !== firebaseUser.uid) {
        throw new Error("The requested administrator email is already linked to a different application identity.");
      }

      await User.findOneAndUpdate(
        { firebaseUid: firebaseUser.uid },
        {
          $set: {
            displayName: "Nexora Administrator",
            status: "ACTIVE",
            // The explicitly provisioned owner account is unrestricted. All other
            // staff remain governed by their assigned MongoDB role permissions.
            roleIds: [adminRole._id],
          },
          $setOnInsert: { firebaseUid: firebaseUser.uid, email },
        },
        { upsert: true, returnDocument: "after", session, setDefaultsOnInsert: true },
      );
    });
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }

  console.log("Administrator provisioned.");
}

main().catch(() => {
  console.error("Administrator provisioning failed. Check protected development logs for diagnostics.");
  process.exit(1);
});
