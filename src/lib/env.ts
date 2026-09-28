import { z } from "zod";

const serverEnvironmentSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default("mlm_platform"),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  MONGODB_MIN_POOL_SIZE: z.coerce.number().int().min(0).max(20).default(0),
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1),
  PAYMENT_PROVIDER: z.string().min(1).default("manual"),
  PAYMENT_MOCK_ENABLED: z.string().default("false").transform((value) => value === "true"),
  PAYMENT_API_KEY: z.string().min(1),
  PAYMENT_WEBHOOK_SECRET: z.string().min(1),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  FIELD_ENCRYPTION_KEY: z.string().min(1),
  INITIAL_ADMIN_EMAIL: z.string().email().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().min(6).optional(),
});

/** Authentication must not depend on optional payment-provider configuration. */
const firebaseAdminEnvironmentSchema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1),
});

/** Core persistence is deliberately independent from optional payment-provider settings. */
const databaseEnvironmentSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default("mlm_platform"),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  MONGODB_MIN_POOL_SIZE: z.coerce.number().int().min(0).max(20).default(0),
});

const clientEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
});

export function getServerEnv() {
  const environment = serverEnvironmentSchema.parse(process.env);
  if (process.env.NODE_ENV === "production" && (environment.PAYMENT_PROVIDER === "mock" || environment.PAYMENT_MOCK_ENABLED)) {
    throw new Error("Mock payments are prohibited when NODE_ENV is production.");
  }
  return environment;
}

export function getFirebaseAdminEnv() {
  return firebaseAdminEnvironmentSchema.parse(process.env);
}

export function getDatabaseEnv() {
  return databaseEnvironmentSchema.parse(process.env);
}

export function getClientEnv() {
  return clientEnvironmentSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}
