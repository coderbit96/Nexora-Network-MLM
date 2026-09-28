import { type Model, model, models, Schema } from "mongoose";

import type { ISetting } from "@/types/domain";
import { schemaOptions } from "./model-utils";

const SettingSchema = new Schema<ISetting>({
  key: { type: String, required: true, immutable: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9_.:-]{2,150}$/ },
  value: { type: Schema.Types.Mixed, required: true },
  valueType: { type: String, required: true, enum: ["STRING", "NUMBER", "BOOLEAN", "JSON"] },
  // Operational secrets belong only in environment variables or a dedicated secret manager.
  isSecret: { type: Boolean, required: true, default: false, immutable: true, select: false, validate: { validator: (value: boolean) => value === false, message: "Settings cannot store secrets." } },
  updatedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
}, schemaOptions);
SettingSchema.index({ key: 1 }, { unique: true });
SettingSchema.index({ updatedAt: -1 });
SettingSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne"], function () {
  throw new Error("Settings must be changed through SystemSettingsService.");
});
SettingSchema.pre("deleteOne", { document: false, query: true }, function () {
  throw new Error("Settings cannot be deleted through query operations.");
});
SettingSchema.pre("deleteMany", function () {
  throw new Error("Settings cannot be deleted through query operations.");
});
export const Setting: Model<ISetting> = (models.Setting as Model<ISetting>) || model<ISetting>("Setting", SettingSchema);
