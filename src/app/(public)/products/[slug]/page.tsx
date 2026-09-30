import type { Metadata } from "next";

import { ProductDetail } from "@/components/catalog/storefront";
import { publicProductBySlug } from "@/services/catalog/catalog-query";

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await publicProductBySlug(slug);
    const description = product.shortDescription || product.description || `View ${product.name} in the Nexora catalogue.`;
    return {
      title: product.name,
      description,
      alternates: { canonical: `/products/${encodeURIComponent(product.slug)}` },
      openGraph: {
        title: product.name,
        description,
        type: "website",
        ...(product.imageUrls[0] ? { images: [{ url: product.imageUrls[0], alt: product.name }] } : {}),
      },
    };
  } catch {
    // Do not let unknown, inactive, or temporarily unavailable product URLs
    // become indexable pages.
    return { title: "Product unavailable", robots: { index: false, follow: false } };
  }
}

export default async function PublicProductDetailPage({ params }: ProductPageProps) { return <ProductDetail slug={(await params).slug} />; }
