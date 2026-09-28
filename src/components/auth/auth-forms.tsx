"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFirebaseClientAuth } from "@/lib/auth/firebase-client";
import { firebaseErrorMessage, responseErrorMessage } from "@/lib/auth/firebase-errors";
import { strongPasswordSchema } from "@/lib/validation/password";

const loginSchema = z.object({ email: z.string().email("Enter a valid email address."), password: z.string().min(1, "Enter your password.") });
const registerSchema = z.object({ firstName: z.string().trim().min(1, "Enter your first name."), lastName: z.string().trim().min(1, "Enter your last name."), email: z.string().email("Enter a valid email address."), password: strongPasswordSchema, referralCode: z.string().trim().optional() });
const forgotSchema = z.object({ email: z.string().email("Enter a valid email address.") });

async function establishSession(idToken: string) {
  const response = await fetch("/api/v1/auth/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
  if (!response.ok) throw new Error(await responseErrorMessage(response));
  return response.json() as Promise<{ data: { status: string; roles: string[] } }>;
}

async function synchronizeVerifiedEmail(idToken: string) {
  const response = await fetch("/api/v1/auth/verify-email", { method: "POST", headers: { authorization: `Bearer ${idToken}` } });
  if (!response.ok) throw new Error(await responseErrorMessage(response));
}

function FieldError({ message, id }: { message?: string; id?: string }) { return message ? <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-destructive">{message}</p> : null; }

export function LoginForm() {
  const router = useRouter(); const searchParams = useSearchParams(); const [submitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const submit = form.handleSubmit(async (values) => { setSubmitting(true); try { const credential = await signInWithEmailAndPassword(getFirebaseClientAuth(), values.email, values.password); if (!credential.user.emailVerified) { await sendEmailVerification(credential.user, { url: `${window.location.origin}/verify-email`, handleCodeInApp: true }); toast.info("Verify your email", { description: "We sent a new verification link to your inbox." }); router.push("/verify-email"); return; } const idToken = await credential.user.getIdToken(true); await synchronizeVerifiedEmail(idToken); const session = await establishSession(idToken); const isAdministrator = session.data.roles.some((role) => ["SUPER_ADMIN", "ADMIN", "STAFF"].includes(role)); const next = searchParams.get("next"); const safeAdminDestination = next?.startsWith("/admin") && !next.startsWith("//") ? next : "/admin"; router.replace(isAdministrator ? safeAdminDestination : "/member"); router.refresh(); } catch (error) { toast.error(error instanceof Error && !error.message.startsWith("Firebase") ? error.message : firebaseErrorMessage(error)); } finally { setSubmitting(false); } });
  return <form onSubmit={submit} className="mt-8 space-y-5" noValidate><div><label htmlFor="email" className="text-sm font-medium">Email address</label><Input id="email" autoComplete="email" className="mt-2" {...form.register("email")} /><FieldError message={form.formState.errors.email?.message} /></div><div><div className="flex justify-between"><label htmlFor="password" className="text-sm font-medium">Password</label><Link className="text-sm font-medium text-primary hover:underline" href="/forgot-password">Forgot password?</Link></div><div className="mt-2"><PasswordInput id="password" autoComplete="current-password" {...form.register("password")} /></div><FieldError message={form.formState.errors.password?.message} /></div><Button className="w-full" size="lg" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</Button><p className="text-center text-sm text-muted-foreground">New to Nexora? <Link className="font-medium text-primary hover:underline" href="/register">Create an account</Link></p></form>;
}

export function RegistrationForm() {
  const router = useRouter(); const params = useSearchParams(); const [submitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema), defaultValues: { firstName: "", lastName: "", email: "", password: "", referralCode: params.get("ref")?.toUpperCase() ?? "" } });
  const submit = form.handleSubmit(async (values) => { setSubmitting(true); try { const response = await fetch("/api/v1/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) }); if (!response.ok) throw new Error(await responseErrorMessage(response)); const credential = await signInWithEmailAndPassword(getFirebaseClientAuth(), values.email, values.password); await sendEmailVerification(credential.user, { url: `${window.location.origin}/verify-email`, handleCodeInApp: true }); toast.success("Account created", { description: "Check your inbox to verify your email." }); router.push("/verify-email"); } catch (error) { toast.error(error instanceof Error ? error.message : firebaseErrorMessage(error)); } finally { setSubmitting(false); } });
  return <form onSubmit={submit} className="mt-8 space-y-4" noValidate><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="firstName" className="text-sm font-medium">First name</label><Input id="firstName" autoComplete="given-name" className="mt-2" {...form.register("firstName")} /><FieldError message={form.formState.errors.firstName?.message} /></div><div><label htmlFor="lastName" className="text-sm font-medium">Last name</label><Input id="lastName" autoComplete="family-name" className="mt-2" {...form.register("lastName")} /><FieldError message={form.formState.errors.lastName?.message} /></div></div><div><label htmlFor="registerEmail" className="text-sm font-medium">Email address</label><Input id="registerEmail" autoComplete="email" className="mt-2" {...form.register("email")} /><FieldError message={form.formState.errors.email?.message} /></div><div><label htmlFor="registerPassword" className="text-sm font-medium">Password</label><div className="mt-2"><PasswordInput id="registerPassword" autoComplete="new-password" {...form.register("password")} /></div><p className="mt-1 text-xs text-muted-foreground">At least 12 characters with uppercase, lowercase, and a number.</p><FieldError message={form.formState.errors.password?.message} /></div><div><label htmlFor="referralCode" className="text-sm font-medium">Referral code <span className="font-normal text-muted-foreground">(optional)</span></label><Input id="referralCode" className="mt-2 uppercase" {...form.register("referralCode")} /><FieldError message={form.formState.errors.referralCode?.message} /></div><Button className="w-full" size="lg" type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</Button><p className="text-center text-sm text-muted-foreground">Already have an account? <Link className="font-medium text-primary hover:underline" href="/login">Sign in</Link></p></form>;
}

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false); const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const submit = form.handleSubmit(async ({ email }) => { setSubmitting(true); try { await sendPasswordResetEmail(getFirebaseClientAuth(), email, { url: `${window.location.origin}/reset-password`, handleCodeInApp: true }); } catch { /* Return the same safe response to avoid account enumeration. */ } finally { setSubmitting(false); toast.success("If an account exists, a password-reset link has been sent."); } });
  return <form onSubmit={submit} className="mt-8 space-y-5" noValidate><div><label htmlFor="forgotEmail" className="text-sm font-medium">Email address</label><Input id="forgotEmail" autoComplete="email" className="mt-2" {...form.register("email")} /><FieldError message={form.formState.errors.email?.message} /></div><Button className="w-full" size="lg" type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send reset link"}</Button><Link className="block text-center text-sm font-medium text-primary hover:underline" href="/login">Back to sign in</Link></form>;
}
