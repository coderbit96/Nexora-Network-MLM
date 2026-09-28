import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";

loadEnvConfig(process.cwd());

import * as registeredModels from "../src/models";

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI must be set in .env.");
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB_NAME || "mlm_platform", maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 });
  const models = Object.values(registeredModels);
  // createIndexes only adds indexes declared by this version of the code. It
  // never drops existing production indexes, unlike Mongoose syncIndexes.
  await Promise.all(models.map((registeredModel) => registeredModel.createIndexes()));
  console.log(`Ensured indexes for ${models.length} models: ${models.map((registeredModel) => registeredModel.modelName).join(", ")}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(() => {
  console.error("Index creation failed. Check protected deployment logs for diagnostics.");
  process.exit(1);
});
