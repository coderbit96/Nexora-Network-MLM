import { type Model, model, models, Schema } from "mongoose";

import type { INotification } from "@/types/domain";
import { schemaOptions } from "./model-utils";

const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  type: { type: String, required: true, enum: ["SYSTEM", "ACCOUNT", "ORDER", "COMMISSION", "WALLET", "WITHDRAWAL"], immutable: true, index: true },
  title: { type: String, required: true, immutable: true, trim: true, maxlength: 180 },
  body: { type: String, required: true, immutable: true, trim: true, maxlength: 2000 },
  readAt: { type: Date },
  actionUrl: { type: String, trim: true, maxlength: 500 },
  metadata: { type: Schema.Types.Mixed, immutable: true },
}, schemaOptions);
NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
export const Notification: Model<INotification> = (models.Notification as Model<INotification>) || model<INotification>("Notification", NotificationSchema);
