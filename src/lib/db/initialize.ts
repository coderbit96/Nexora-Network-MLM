import "server-only";

import { connectToDatabase } from "@/lib/db/mongoose";
import * as registeredModels from "@/models";

/** Creates declared indexes. Run deliberately during deploy/maintenance; never set autoIndex for production traffic. */
export async function synchronizeDatabaseIndexes() {
  await connectToDatabase();
  const models = Object.values(registeredModels);
  await Promise.all(models.map((registeredModel) => registeredModel.syncIndexes()));
  return models.map((registeredModel) => registeredModel.modelName);
}
