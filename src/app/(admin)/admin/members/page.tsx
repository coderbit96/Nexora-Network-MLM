import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { MemberManager } from "@/components/admin/member-manager";

export default function MembersPage() {
  return <><AdminPageHeader eyebrow="Member management" title="Members" description="Review account status, sponsors, team growth, and operational history." /><MemberManager /></>;
}
