import { ProductManager } from "@/components/catalog/admin-catalog";

export default function AdminProductsPage() { return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Catalogue management</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Products</h1><p className="mt-2 text-muted-foreground">Maintain authoritative product, volume, inventory, and publication data.</p></div><ProductManager /></>; }
