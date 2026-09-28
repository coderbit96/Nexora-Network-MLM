"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Building2, CircleDollarSign, Loader2, Save, ShieldCheck, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { businessSettingsSchema, defaultBusinessSettings, type BusinessSettings } from "@/lib/validation/settings";
import { formatDateTime } from "@/lib/utils/format";

type SettingsResponse = { success: true; data: { settings: BusinessSettings; updatedAt?: string } } | { success: false; error?: { message?: string } };
const fieldError = (message?: string) => message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null;

function SettingField({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}{help ? <span className="text-xs font-normal leading-5 text-muted-foreground">{help}</span> : null}</label>;
}

export function SystemSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const form = useForm<BusinessSettings>({ resolver: zodResolver(businessSettingsSchema), defaultValues: defaultBusinessSettings, mode: "onBlur" });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = form;

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/admin/settings", { cache: "no-store" }).then(async (response) => ({ response, payload: await response.json() as SettingsResponse })).then(({ response, payload }) => {
      if (!active) return;
      if (!response.ok || !payload.success) throw new Error();
      reset(payload.data.settings); setUpdatedAt(payload.data.updatedAt); setFailed(false);
    }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reset]);

  const submit = handleSubmit(async (settings) => {
    try {
      const response = await fetch("/api/v1/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
      const payload = await response.json() as SettingsResponse;
      if (!response.ok || !payload.success) throw new Error(payload.success ? "Unable to update settings." : payload.error?.message ?? "Unable to update settings.");
      reset(payload.data.settings); setUpdatedAt(payload.data.updatedAt); toast.success("System settings saved and audited.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update settings."); }
  });

  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading settings…</CardContent></Card>;
  if (failed) return <ErrorState title="Settings could not be loaded" description="Only Super Admins may view and update this configuration." />;

  return <form className="space-y-6" onSubmit={submit}>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-semibold">Super Admin configuration</p><p className="mt-1 text-muted-foreground">Changes are validated server-side and written to the audit log. Credentials and provider secrets remain environment-only.</p></div></div>{updatedAt ? <span className="text-xs text-muted-foreground">Updated {formatDateTime(updatedAt)}</span> : null}</div>

    <Card><CardHeader><div className="flex items-center gap-2"><Building2 className="size-5 text-primary" /><CardTitle>Company and contact</CardTitle></div><CardDescription>Displayed business identity and support channels. These values never include service credentials.</CardDescription></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><SettingField label="Legal company name"><Input {...register("company.legalName")} />{fieldError(errors.company?.legalName?.message)}</SettingField><SettingField label="Trading name"><Input {...register("company.tradingName")} /></SettingField><SettingField label="Website"><Input type="url" placeholder="https://example.com" {...register("company.website")} />{fieldError(errors.company?.website?.message)}</SettingField><SettingField label="Support email"><Input type="email" {...register("contact.supportEmail")} />{fieldError(errors.contact?.supportEmail?.message)}</SettingField><SettingField label="Support phone"><Input {...register("contact.supportPhone")} /></SettingField><SettingField label="WhatsApp number" help="International format; this is business contact information, not a credential."><Input placeholder="+919999999999" {...register("contact.whatsappNumber")} />{fieldError(errors.contact?.whatsappNumber?.message)}</SettingField><SettingField label="Address line 1"><Input {...register("company.address.line1")} /></SettingField><SettingField label="Address line 2"><Input {...register("company.address.line2")} /></SettingField><SettingField label="City"><Input {...register("company.address.city")} /></SettingField><SettingField label="State / region"><Input {...register("company.address.state")} /></SettingField><SettingField label="Postal code"><Input {...register("company.address.postalCode")} /></SettingField><SettingField label="Country"><Input {...register("company.address.country")} /></SettingField></CardContent></Card>

    <Card><CardHeader><div className="flex items-center gap-2"><CircleDollarSign className="size-5 text-primary" /><CardTitle>Currency and withdrawals</CardTitle></div><CardDescription>Amounts use integer minor units. For INR, 10,000 minor units equals ₹100.00.</CardDescription></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><SettingField label="Base currency" help="Locked once products, wallets, orders, payments, or commissions exist."><Input className="uppercase" maxLength={3} {...register("currency")} />{fieldError(errors.currency?.message)}</SettingField><SettingField label="Minimum withdrawal (minor units)"><Input inputMode="numeric" {...register("withdrawal.minimumMinor")} />{fieldError(errors.withdrawal?.minimumMinor?.message)}</SettingField><label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm font-medium"><input className="size-4 accent-primary" type="checkbox" {...register("withdrawal.maximumEnabled")} />Enable a maximum withdrawal</label><SettingField label="Maximum withdrawal (minor units)" help="Applied only when the maximum option is enabled."><Input inputMode="numeric" {...register("withdrawal.maximumMinor")} />{fieldError(errors.withdrawal?.maximumMinor?.message)}</SettingField><label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm font-medium md:col-span-2"><input className="size-4 accent-primary" type="checkbox" {...register("withdrawal.requirePaymentDetails")} />Require verified payment details before a member can request a withdrawal</label></CardContent></Card>

    <Card><CardHeader><div className="flex items-center gap-2"><ShoppingBag className="size-5 text-primary" /><CardTitle>Commission and commerce</CardTitle></div><CardDescription>Rule rates, levels, and effective dates remain in immutable-reference Commission Rules. A change here affects only future eligibility checks.</CardDescription></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><SettingField label="Minimum commission-eligible order (minor units)" help="Orders below this subtotal receive no commission. Past commission records are unchanged."><Input inputMode="numeric" {...register("commission.minimumEligibleOrderMinor")} />{fieldError(errors.commission?.minimumEligibleOrderMinor?.message)}</SettingField><SettingField label="Order number prefix"><Input maxLength={8} className="uppercase" {...register("commerce.orderNumberPrefix")} />{fieldError(errors.commerce?.orderNumberPrefix?.message)}</SettingField><div className="rounded-lg border border-border p-3 text-sm"><p className="font-medium">Commission eligibility event</p><p className="mt-1 text-muted-foreground">Verified payment success</p></div><div className="rounded-lg border border-border p-3 text-sm"><p className="font-medium">Active plan scope</p><p className="mt-1 text-muted-foreground">Direct referral and level commission</p></div><div className="rounded-lg border border-border p-3 text-sm md:col-span-2"><p className="font-medium">Commerce safeguards</p><p className="mt-1 text-muted-foreground">Inventory tracking and payment verification before fulfillment are enforced and cannot be disabled from settings.</p></div></CardContent></Card>

    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" /><div><p className="font-semibold">Historical financial data is never rewritten</p><p className="mt-1 text-muted-foreground">Commission transactions retain their rule ID, effective date, basis, rate, base, and amount. Corrections require reversal or adjustment entries.</p></div></div></div>
    <div className="flex justify-end"><Button disabled={!isDirty || isSubmitting} type="submit">{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{isSubmitting ? "Saving…" : "Save audited settings"}</Button></div>
  </form>;
}
