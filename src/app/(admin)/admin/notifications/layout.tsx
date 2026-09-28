import { ADMIN_PAGE_PERMISSION } from "@/config/admin-page-permissions";
import { requireAdminPagePermission } from "@/lib/auth/admin-page-authorization";

export default async function NotificationsLayout({ children }: { children: React.ReactNode }) { await requireAdminPagePermission(ADMIN_PAGE_PERMISSION.notifications, "/admin/notifications"); return children; }
