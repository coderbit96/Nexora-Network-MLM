import { CartPanel } from "@/components/orders/order-panels";

export default function CartPage() { return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Cart</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Review your order</h1><p className="mt-2 text-muted-foreground">Products and totals are verified again when you checkout.</p></div><CartPanel /></>; }
