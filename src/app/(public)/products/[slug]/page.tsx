import { ProductDetail } from "@/components/catalog/storefront";

export default async function PublicProductDetailPage({ params }: { params: Promise<{ slug: string }> }) { return <ProductDetail slug={(await params).slug} />; }
