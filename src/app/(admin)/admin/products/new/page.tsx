import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminProductForm } from "@/components/admin/product-form";
import { PERMISSION } from "@/config/permissions";
import { requireAdminPagePermission } from "@/lib/auth/admin-page-authorization";

export default async function NewProductPage() {
  await requireAdminPagePermission(PERMISSION.PRODUCTS.CREATE, "/admin/products/new");
  return <><AdminPageHeader eyebrow="Catalogue management" title="Create product" description="Add a server-validated catalogue product. It remains a draft until activated." /><AdminProductForm /></>;
}
