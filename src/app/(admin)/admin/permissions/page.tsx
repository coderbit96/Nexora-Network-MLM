import { PermissionGuide } from "@/components/admin/permission-guide";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PERMISSION_CATALOG } from "@/config/permissions";

export default function PermissionsPage() {
  return <><AdminPageHeader eyebrow="Access control" title="Permissions & functions" description="Understand what each role can do before assigning it to a staff member." /><PermissionGuide permissions={PERMISSION_CATALOG} /></>;
}
