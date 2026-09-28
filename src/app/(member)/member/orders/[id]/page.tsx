import { OrderDetailPanel } from "@/components/orders/order-panels";

export default async function MemberOrderPage({ params }: { params: Promise<{ id: string }> }) { return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Order detail</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Order overview</h1></div><OrderDetailPanel id={(await params).id} /></>; }
