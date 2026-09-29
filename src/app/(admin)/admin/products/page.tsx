import { ProductManager } from "@/components/catalog/admin-catalog";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminProductsPage() { return <><AdminPageHeader eyebrow="Catalogue management" title="Products" description="Maintain authoritative product, volume, inventory, and publication data." /><ProductManager /></>; }
