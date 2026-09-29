import { AdminProductManager } from "@/components/admin/product-manager";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminProductsPage() { return <><AdminPageHeader eyebrow="Catalogue management" title="Products" description="Maintain authoritative product, volume, inventory, and publication data." /><AdminProductManager /></>; }
