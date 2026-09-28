import { CatalogStorefront } from "@/components/catalog/storefront";

export default function MemberProductsPage() { return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Products</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Member catalogue</h1><p className="mt-2 text-muted-foreground">Availability and final checkout totals are always confirmed on the server.</p></div><CatalogStorefront member /></>; }
