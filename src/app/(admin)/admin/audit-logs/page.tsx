import { AuditLogExplorer } from "@/components/admin/audit-log-explorer";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AuditLogsPage() {
  return <><AdminPageHeader eyebrow="Security" title="Audit logs" description="Immutable administrative, security, and financial operational history." /><AuditLogExplorer /></>;
}
