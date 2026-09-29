import { SystemSettingsForm } from "@/components/admin/system-settings-form";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default async function SettingsPage() {
  return <><AdminPageHeader eyebrow="Platform configuration" title="System settings" description="Company, currency, withdrawal, commerce, commission eligibility, and contact configuration for the platform." /><SystemSettingsForm /></>;
}
