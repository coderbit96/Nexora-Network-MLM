"use client";

import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AddToCartButton } from "@/components/orders/order-panels";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils/format";

type Category = { id: string; name: string; slug: string; description: string };
type Product = {
  id: string; name: string; slug: string; shortDescription: string; description: string; imageUrls: string[];
  priceMinor: string; salePriceMinor?: string; currency: string; pv: string; bv: string; stockQuantity: number;
  inStock: boolean; commissionEligible: boolean; featured: boolean; category: { name: string; slug: string } | null;
};
type ProductPage = { products: Product[]; pagination: { total: number; page: number; totalPages: number } };
type Api<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
const optimizedImageHosts = new Set((process.env.NEXT_PUBLIC_IMAGE_REMOTE_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));

async function fetchData<T>(path: string) {
  const response = await fetch(path);
  const result = await response.json() as Api<T>;
  if (!response.ok || !result.success) throw new Error(!result.success ? result.error?.message ?? "Request failed" : "Request failed");
  return result.data;
}

function ProductImage({ product, detail = false }: { product: Product; detail?: boolean }) {
  if (!product.imageUrls[0]) return <div className="grid size-full place-items-center text-sm font-medium text-muted-foreground">{detail ? "Nexora product" : "Nexora"}</div>;
  let optimize = false;
  try { optimize = optimizedImageHosts.has(new URL(product.imageUrls[0]).hostname.toLowerCase()); } catch { /* URL validation occurs on the server. */ }
  return <Image src={product.imageUrls[0]} alt={product.name} fill priority={detail} unoptimized={!optimize} sizes={detail ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"} className="object-cover transition duration-300 group-hover:scale-105" />;
}

function ProductCard({ product, member }: { product: Product; member?: boolean }) {
  const href = member ? `/member/products/${product.slug}` : `/products/${product.slug}`;
  return <Card className="group overflow-hidden"><Link href={href} className="block"><div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-primary/10 via-muted to-secondary"><ProductImage product={product} /></div><CardContent className="p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{product.category?.name ?? "Catalogue"}</p>{product.featured ? <Badge>Featured</Badge> : null}</div><h2 className="mt-2 text-lg font-semibold">{product.name}</h2><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.shortDescription || product.description || "Premium network product."}</p><div className="mt-4 flex items-end justify-between"><div><p className="text-lg font-bold">{formatCurrency(product.salePriceMinor ?? product.priceMinor, product.currency)}</p>{product.salePriceMinor ? <p className="text-xs text-muted-foreground line-through">{formatCurrency(product.priceMinor, product.currency)}</p> : null}</div><Badge variant={product.inStock ? "success" : "warning"}>{product.inStock ? `${product.stockQuantity} in stock` : "Out of stock"}</Badge></div></CardContent></Link></Card>;
}

export function CatalogStorefront({ member = false }: { member?: boolean }) {
  const [categories, setCategories] = useState<Category[]>([]); const [data, setData] = useState<ProductPage | null>(null); const [category, setCategory] = useState(""); const [query, setQuery] = useState(""); const [sort, setSort] = useState("newest"); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false);
  const load = useCallback(async () => { setLoading(true); setFailed(false); const params = new URLSearchParams({ page: String(page), sort }); if (category) params.set("category", category); if (query.trim()) params.set("q", query.trim()); try { const [categoryData, productData] = await Promise.all([fetchData<Category[]>("/api/v1/catalog/categories"), fetchData<ProductPage>(`/api/v1/catalog/products?${params}`)]); setCategories(categoryData); setData(productData); } catch { setFailed(true); } finally { setLoading(false); } }, [category, page, query, sort]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  return <div className="space-y-7"><div className="flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search products or SKU" className="pl-9" /></div><div className="flex gap-2"><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="h-10 min-w-40 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="Sort products" className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="name">Name</option></select></div></div><div className="flex flex-wrap gap-2">{categories.map((item) => <Button key={item.id} size="sm" variant={category === item.slug ? "default" : "outline"} onClick={() => { setCategory(category === item.slug ? "" : item.slug); setPage(1); }}>{item.name}</Button>)}</div>{loading && !data ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-80" />)}</div> : failed || !data ? <ErrorState title="Products could not be loaded" /> : data.products.length ? <><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{data.products.map((product) => <ProductCard key={product.id} product={product} member={member} />)}</div><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{data.pagination.total} products</p><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div></div></> : <EmptyState title="No products found" description="Try another category or search term." action={<Button variant="outline" onClick={() => { setCategory(""); setQuery(""); }}>Clear filters</Button>} />}</div>;
}

export function ProductDetail({ slug, member = false }: { slug: string; member?: boolean }) {
  const [product, setProduct] = useState<Product | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => { void fetchData<Product>(`/api/v1/catalog/products/${encodeURIComponent(slug)}`).then(setProduct).catch(() => setFailed(true)); }, [slug]);
  if (!product && !failed) return <Skeleton className="h-[32rem]" />;
  if (!product || failed) return <ErrorState title="Product could not be loaded" description="This product may no longer be available." />;
  return <div className="grid gap-8 lg:grid-cols-2"><div className="group relative aspect-square overflow-hidden rounded-2xl bg-muted"><ProductImage product={product} detail /></div><div className="py-2"><p className="text-sm font-semibold text-primary">{product.category?.name ?? "Catalogue"}</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{product.name}</h1><div className="mt-4 flex items-baseline gap-3"><p className="text-3xl font-bold">{formatCurrency(product.salePriceMinor ?? product.priceMinor, product.currency)}</p>{product.salePriceMinor ? <p className="text-muted-foreground line-through">{formatCurrency(product.priceMinor, product.currency)}</p> : null}</div><p className="mt-5 whitespace-pre-line leading-7 text-muted-foreground">{product.description || product.shortDescription}</p><div className="mt-6 flex flex-wrap gap-2"><Badge variant={product.inStock ? "success" : "warning"}>{product.inStock ? `${product.stockQuantity} available` : "Out of stock"}</Badge>{product.commissionEligible ? <Badge variant="outline">{product.pv} PV · {product.bv} BV</Badge> : <Badge variant="outline">Not commission eligible</Badge>}</div>{member ? <AddToCartButton productId={product.id} disabled={!product.inStock} /> : <p className="mt-8 text-sm text-muted-foreground">Sign in as a member to add products to a cart. Final price, availability, PV, and BV are verified on the server at checkout.</p>}</div></div>;
}
