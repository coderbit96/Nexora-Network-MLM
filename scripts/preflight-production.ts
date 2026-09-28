import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  // Import after .env loading so validation sees the deployment configuration.
  const { getServerEnv } = await import("../src/lib/env");
  const issues: string[] = [];

  if (process.env.NODE_ENV !== "production") issues.push("NODE_ENV must be production.");
  if (!process.env.NEXT_PUBLIC_APP_URL || /localhost|127\.0\.0\.1/i.test(process.env.NEXT_PUBLIC_APP_URL)) {
    issues.push("NEXT_PUBLIC_APP_URL must be the public HTTPS application URL.");
  }
  if (process.env.INITIAL_ADMIN_EMAIL || process.env.INITIAL_ADMIN_PASSWORD) {
    issues.push("INITIAL_ADMIN_* values are development seeding inputs and must be absent in production.");
  }
  if (process.env.PAYMENT_PROVIDER === "mock" || process.env.PAYMENT_MOCK_ENABLED === "true") {
    issues.push("Mock payments must be disabled in production.");
  }

  try {
    getServerEnv();
  } catch {
    issues.push("Required server environment configuration is missing or invalid.");
  }

  if (issues.length) {
    console.error("Production preflight failed:");
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
    return;
  }

  console.log("Production preflight passed. Environment values were validated without printing secrets.");
}

main().catch(() => {
  console.error("Production preflight could not complete. Check the deployment configuration.");
  process.exitCode = 1;
});
