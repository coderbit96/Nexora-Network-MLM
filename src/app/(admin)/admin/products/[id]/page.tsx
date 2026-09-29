import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminProductForm } from "@/components/admin/product-form";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <><AdminPageHeader eyebrow="Catalogue management" title="Product details" description="Edits apply only to future catalogue and checkout resolution; past order lines retain their captured values." /><AdminProductForm productId={id} /></>; }
