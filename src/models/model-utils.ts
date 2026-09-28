import { Schema } from "mongoose";

/** Rejects Mongoose update operations for append-only financial and audit records. */
export function makeImmutable(schema: Schema) {
  schema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne"], function () {
    throw new Error("This record is immutable. Create a compensating record instead.");
  });
  schema.pre("deleteOne", { document: false, query: true }, function () {
    throw new Error("This record cannot be deleted.");
  });
  schema.pre("deleteMany", function () {
    throw new Error("This record cannot be deleted.");
  });
}

export const schemaOptions = { timestamps: true, strict: "throw" as const, minimize: false, versionKey: "version" };

export function nonNegativeBigInt(value: bigint) {
  return value >= 0n;
}

export function positiveBigInt(value: bigint) {
  return value > 0n;
}
