"use client";

import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { getFirebaseClientAuth } from "@/lib/auth/firebase-client";
import { firebaseErrorMessage, responseErrorMessage } from "@/lib/auth/firebase-errors";
import { isStrongPassword } from "@/lib/validation/password";

export function VerifyEmailFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Check your inbox for the verification link.");

  useEffect(() => {
    const code = params.get("oobCode");
    if (!code) return;
    void applyActionCode(getFirebaseClientAuth(), code)
      .then(() => setMessage("Your email has been verified. You can now sign in."))
      .catch(() => setMessage("This verification link is invalid or expired."));
  }, [params]);

  const activate = async () => {
    const user = getFirebaseClientAuth().currentUser;
    if (!user) { router.push("/login"); return; }
    setLoading(true);
    try {
      await user.reload();
      const token = await user.getIdToken(true);
      const response = await fetch("/api/v1/auth/verify-email", { method: "POST", headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      toast.success("Email verified. You can now sign in.");
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : firebaseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return <div className="mt-8 space-y-5"><p className="rounded-lg border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">{message}</p><Button className="w-full" onClick={activate} disabled={loading}>{loading ? "Verifying..." : "I've verified my email"}</Button><Link className="block text-center text-sm font-medium text-primary hover:underline" href="/login">Back to sign in</Link></div>;
}

export function ResetPasswordFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState("");
  const [loading, setLoading] = useState(false);
  const code = params.get("oobCode");
  const [valid, setValid] = useState<boolean | null>(() => code ? null : false);
  const passwordIsStrong = isStrongPassword(password);

  useEffect(() => {
    if (code) void verifyPasswordResetCode(getFirebaseClientAuth(), code).then(() => setValid(true)).catch(() => setValid(false));
  }, [code]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code || !passwordIsStrong || password !== confirmed) return;
    setLoading(true);
    try {
      await confirmPasswordReset(getFirebaseClientAuth(), code, password);
      toast.success("Password reset successfully. You can now sign in.");
      router.replace("/login");
    } catch (error) {
      toast.error(firebaseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (valid === null) return <p className="mt-8 text-sm text-muted-foreground">Checking your reset link...</p>;
  if (!valid) return <div className="mt-8 space-y-4"><p className="rounded-lg border border-destructive/20 bg-red-50 p-4 text-sm text-red-800">This password reset link is invalid or expired.</p><Link className="text-sm font-medium text-primary hover:underline" href="/forgot-password">Request a new link</Link></div>;

  return <form onSubmit={submit} className="mt-8 space-y-5"><div><label htmlFor="newPassword" className="text-sm font-medium">New password</label><div className="mt-2"><PasswordInput id="newPassword" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>{password && !passwordIsStrong ? <p className="mt-1 text-xs text-destructive">Use 12+ characters with uppercase, lowercase, and a number.</p> : null}</div><div><label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</label><div className="mt-2"><PasswordInput id="confirmPassword" autoComplete="new-password" value={confirmed} onChange={(event) => setConfirmed(event.target.value)} /></div>{confirmed && confirmed !== password && <p className="mt-1 text-xs text-destructive">Passwords do not match.</p>}</div><Button className="w-full" size="lg" type="submit" disabled={loading || !passwordIsStrong || password !== confirmed}>{loading ? "Resetting password..." : "Set new password"}</Button></form>;
}
