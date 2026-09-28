import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { connectToDatabase } from "../src/lib/db/mongoose";
import { ensureSystemRbac } from "../src/services/auth/rbac";

async function main() {
  await connectToDatabase();
  await ensureSystemRbac();
  console.log("Initialized system permissions and roles: SUPER_ADMIN, ADMIN, STAFF, MEMBER.");
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("RBAC initialization failed.", { name: error instanceof Error ? error.name : typeof error, code: typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : undefined });
  process.exit(1);
});
