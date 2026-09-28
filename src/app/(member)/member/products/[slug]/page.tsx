import { ProductDetail } from "@/components/catalog/storefront";

export default async function MemberProductDetailPage({ params }: { params: Promise<{ slug: string }> }) { return <ProductDetail slug={(await params).slug} member />; }
