import "server-only";

import mongoose from "mongoose";

import { getDatabaseEnv } from "@/lib/env";

declare global {
  var mongooseConnection: { connection: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cached = global.mongooseConnection ?? { connection: null, promise: null };
global.mongooseConnection = cached;

export async function connectToDatabase() {
  if (cached.connection?.connection.readyState === 1) return cached.connection;
  if (cached.connection) cached.connection = null;

  const { MONGODB_URI, MONGODB_DB_NAME, MONGODB_MAX_POOL_SIZE, MONGODB_MIN_POOL_SIZE } = getDatabaseEnv();
  cached.promise ??= mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DB_NAME,
    // Preserve BSON int64 money as bigint, including lean queries and aggregates.
    // Otherwise the driver returns numbers and checkout/ledger arithmetic fails.
    useBigInt64: true,
    autoIndex: process.env.NODE_ENV !== "production",
    maxPoolSize: MONGODB_MAX_POOL_SIZE,
    minPoolSize: MONGODB_MIN_POOL_SIZE,
    maxIdleTimeMS: 30_000,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    retryWrites: true,
  });

  try {
    cached.connection = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.connection;
}
