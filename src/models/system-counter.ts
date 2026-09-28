import { type Model, model, models, Schema } from "mongoose";

import type { ISystemCounter } from "@/types/domain";

const SystemCounterSchema = new Schema<ISystemCounter>({
  _id: { type: String, required: true, immutable: true },
  sequence: { type: Number, required: true, default: 0, min: 0, validate: { validator: Number.isSafeInteger, message: "Sequence must be a safe integer." } },
}, { timestamps: true, strict: "throw", versionKey: "version" });

export const SystemCounter: Model<ISystemCounter> = (models.SystemCounter as Model<ISystemCounter>) || model<ISystemCounter>("SystemCounter", SystemCounterSchema);
