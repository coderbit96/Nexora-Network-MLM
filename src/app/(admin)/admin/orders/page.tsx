import { AdminOrdersPanel } from "@/components/orders/order-panels";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminOrdersPage() { return <><AdminPageHeader eyebrow="Order operations" title="Orders" description="Manage fulfillment while keeping payment verification and commissions server-controlled." /><AdminOrdersPanel /></>; }
