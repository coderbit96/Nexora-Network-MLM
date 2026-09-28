import { ADMIN_PAGE_PERMISSION } from "@/config/admin-page-permissions";
import { requireAdminPagePermission } from "@/lib/auth/admin-page-authorization";

// Settings remain a Super Admin-owned feature even though its page mapping is
// explicit, matching its server-side API authorization policy.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) { await requireAdminPagePermission(ADMIN_PAGE_PERMISSION.settings, "/admin/settings", "SUPER_ADMIN"); return children; }
