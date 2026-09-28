import { AuditLogExplorer } from "@/components/admin/audit-log-explorer";

export default function AuditLogsPage() {
  return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Security</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Audit logs</h1><p className="mt-2 text-muted-foreground">Immutable administrative, security, and financial operational history.</p></div><AuditLogExplorer /></>;
}
