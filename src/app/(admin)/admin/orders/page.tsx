import { AdminOrdersPanel } from "@/components/orders/order-panels";

export default function AdminOrdersPage() { return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Order operations</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Orders</h1><p className="mt-2 text-muted-foreground">Manage fulfillment while keeping payment verification and commissions server-controlled.</p></div><AdminOrdersPanel /></>; }
