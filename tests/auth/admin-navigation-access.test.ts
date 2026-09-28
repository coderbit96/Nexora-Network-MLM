import assert from "node:assert/strict";
import test from "node:test";

import { adminNavigationAccess } from "../../src/config/admin-navigation-access";
import { adminNavigation } from "../../src/config/navigation";

test("server-safe admin navigation access metadata matches client navigation", () => {
  assert.deepEqual(
    adminNavigationAccess.map((item) => ({ label: item.label, permission: item.permission, superAdminOnly: item.superAdminOnly })),
    adminNavigation.map((item) => ({ label: item.label, permission: item.permission, superAdminOnly: item.superAdminOnly })),
  );
});
