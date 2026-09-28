import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ADMIN_PAGE_PERMISSION } from "@/config/admin-page-permissions";
import { requireAdminPagePermission } from "@/lib/auth/admin-page-authorization";

export default async function AdminDashboardPage() {
  await requireAdminPagePermission(ADMIN_PAGE_PERMISSION.dashboard, "/admin");
  return <AdminDashboard />;
}
