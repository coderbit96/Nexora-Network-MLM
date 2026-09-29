import { AdminCategoryManager } from "@/components/admin/category-manager";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminCategoriesPage() { return <><AdminPageHeader eyebrow="Catalogue management" title="Categories" description="Organize public catalogue navigation with controlled categories." /><AdminCategoryManager /></>; }
