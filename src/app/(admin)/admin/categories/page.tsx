import { CategoryManager } from "@/components/catalog/admin-catalog";

export default function AdminCategoriesPage() { return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Catalogue management</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Categories</h1><p className="mt-2 text-muted-foreground">Organize public catalogue navigation with controlled categories.</p></div><CategoryManager /></>; }
