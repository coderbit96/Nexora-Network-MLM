import { ADMIN_PAGE_PERMISSION } from "@/config/admin-page-permissions";
import { requireAdminPagePermission } from "@/lib/auth/admin-page-authorization";
import { redirect } from "next/navigation";

export default async function AdminDashboardPage() {
  await requireAdminPagePermission(ADMIN_PAGE_PERMISSION.dashboard, "/admin");
  redirect("/admin/dashboard");
}
