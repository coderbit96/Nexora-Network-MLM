import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StaffAccountForm } from "@/components/admin/staff-account-form";
import { PERMISSION } from "@/config/permissions";
import { requireAdminPagePermission } from "@/lib/auth/admin-page-authorization";

export default async function NewStaffPage() {
  await requireAdminPagePermission(PERMISSION.STAFF.CREATE, "/admin/staff/new");
  return <><AdminPageHeader eyebrow="Access control" title="Create staff account" description="Provision a role-bound Admin or Staff application account with a Firebase sign-in." /><StaffAccountForm /></>;
}
