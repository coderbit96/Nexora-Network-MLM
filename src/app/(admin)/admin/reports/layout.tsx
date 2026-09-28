import { ADMIN_PAGE_PERMISSION } from "@/config/admin-page-permissions";
import { requireAdminPagePermission } from "@/lib/auth/admin-page-authorization";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) { await requireAdminPagePermission(ADMIN_PAGE_PERMISSION.reports, "/admin/reports"); return children; }
