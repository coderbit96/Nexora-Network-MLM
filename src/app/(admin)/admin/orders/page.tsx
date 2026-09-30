import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminOrdersManager } from "@/components/admin/admin-orders-manager";

export default function AdminOrdersPage() { return <><AdminPageHeader eyebrow="Order operations" title="Orders" description="Manage fulfillment while keeping payment verification and commissions server-controlled." /><AdminOrdersManager /></>; }
