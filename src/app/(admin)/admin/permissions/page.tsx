import { PermissionGuide } from "@/components/admin/permission-guide";
import { PERMISSION_CATALOG } from "@/config/permissions";

export default function PermissionsPage() {
  return <>
    <div className="mb-8"><p className="text-sm font-semibold text-primary">Access control</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Permissions & functions</h1><p className="mt-2 max-w-2xl text-muted-foreground">Understand what each role can do before assigning it to a staff member.</p></div>
    <PermissionGuide permissions={PERMISSION_CATALOG} />
  </>;
}
