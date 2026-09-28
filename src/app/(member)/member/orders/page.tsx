import { MemberOrdersPanel } from "@/components/orders/order-panels";

export default function MemberOrdersPage() { return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Orders</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Your order history</h1><p className="mt-2 text-muted-foreground">Review payment, fulfillment, and commission processing states.</p></div><MemberOrdersPanel /></>; }
