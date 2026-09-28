import { type Model, model, models, Schema } from "mongoose";

import type { ICategory } from "@/types/domain";
import { schemaOptions } from "./model-utils";

const CategorySchema = new Schema<ICategory>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  description: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, required: true, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
}, schemaOptions);
CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ status: 1, name: 1 });
export const Category: Model<ICategory> = (models.Category as Model<ICategory>) || model<ICategory>("Category", CategorySchema);
