import assert from "node:assert/strict";
import test from "node:test";

import { adminNavigation, memberNavigation, staffNavigation } from "@/config/navigation";

test("every workspace navigation entry is actionable", () => {
  for (const [workspace, entries] of Object.entries({ adminNavigation, memberNavigation, staffNavigation })) {
    for (const entry of entries) {
      assert.ok(entry.href, `${workspace}: ${entry.label} must have a route`);
      assert.equal(entry.disabled, undefined, `${workspace}: ${entry.label} must not be presented as a dead action`);
    }
  }
});
