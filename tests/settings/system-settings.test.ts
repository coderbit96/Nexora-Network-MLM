import assert from "node:assert/strict";
import test from "node:test";

import { Setting } from "@/models";
import { businessSettingsSchema, defaultBusinessSettings } from "@/lib/validation/settings";

test("business settings accept a complete, safe configuration", () => {
  const result = businessSettingsSchema.safeParse({ ...defaultBusinessSettings, company: { ...defaultBusinessSettings.company, legalName: "Nexora India Private Limited" }, withdrawal: { ...defaultBusinessSettings.withdrawal, maximumEnabled: true, maximumMinor: "500000" } });
  assert.equal(result.success, true);
});

test("business settings reject an invalid withdrawal range and unknown secret fields", () => {
  const invalidRange = businessSettingsSchema.safeParse({ ...defaultBusinessSettings, withdrawal: { ...defaultBusinessSettings.withdrawal, maximumEnabled: true, maximumMinor: "9999" } });
  assert.equal(invalidRange.success, false);
  const secretInjection = businessSettingsSchema.safeParse({ ...defaultBusinessSettings, firebasePrivateKey: "not-allowed" });
  assert.equal(secretInjection.success, false);
});

test("settings cannot be marked as database secrets or updated through unrestricted queries", async () => {
  const setting = new Setting({ key: "business.configuration", value: defaultBusinessSettings, valueType: "JSON", isSecret: true });
  await assert.rejects(setting.validate(), /cannot store secrets/i);
  await assert.rejects(Setting.updateOne({}, { $set: { value: {} } }).exec(), /SystemSettingsService/i);
});
