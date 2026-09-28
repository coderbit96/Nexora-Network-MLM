import { ADMIN_PAGE_PERMISSION } from "@/config/admin-page-permissions";
import { requireAdminPagePermission } from "@/lib/auth/admin-page-authorization";

export default async function GenealogyLayout({ children }: { children: React.ReactNode }) { await requireAdminPagePermission(ADMIN_PAGE_PERMISSION.genealogy, "/admin/genealogy"); return children; }
