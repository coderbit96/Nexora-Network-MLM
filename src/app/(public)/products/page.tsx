import type { Metadata } from "next";
import { CatalogStorefront } from "@/components/catalog/storefront";

export const metadata: Metadata = { title: "Products", description: "Browse Nexora's active catalogue, current availability, and public pricing.", alternates: { canonical: "/products" } };
export default function ProductsPage() { return <section><div className="border-b border-black/15 pb-10"><p className="eyebrow text-primary">Nexora catalogue</p><h1 className="display-type mt-6 text-5xl font-bold sm:text-7xl">Products for<br />your network.</h1><p className="mt-6 max-w-xl leading-7 text-muted-foreground">Browse active products, stock availability, and current public pricing. Checkout always revalidates final values on the server.</p></div><div className="mt-10"><CatalogStorefront /></div></section>; }
