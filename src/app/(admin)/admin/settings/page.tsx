import { SystemSettingsForm } from "@/components/admin/system-settings-form";

export default async function SettingsPage() {
  return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Platform configuration</p><h1 className="mt-2 text-3xl font-bold tracking-tight">System settings</h1><p className="mt-2 max-w-2xl text-muted-foreground">Company, currency, withdrawal, commerce, commission eligibility, and contact configuration for the platform.</p></div><SystemSettingsForm /></>;
}
