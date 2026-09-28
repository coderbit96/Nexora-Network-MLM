import { MemberDetail } from "@/components/admin/member-detail";
export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) { return <MemberDetail id={(await params).id} />; }
