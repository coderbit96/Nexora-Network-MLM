import { type Model, model, models, Schema } from "mongoose";

import type { IPermission } from "@/types/domain";
import { schemaOptions } from "./model-utils";

const PermissionSchema = new Schema<IPermission>({
  key: { type: String, required: true, immutable: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9_.:-]{2,100}$/ },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500 },
  module: { type: String, required: true, trim: true, lowercase: true, index: true },
}, schemaOptions);
PermissionSchema.index({ key: 1 }, { unique: true });
PermissionSchema.index({ module: 1, key: 1 });
export const Permission: Model<IPermission> = (models.Permission as Model<IPermission>) || model<IPermission>("Permission", PermissionSchema);
