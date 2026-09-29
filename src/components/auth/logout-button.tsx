"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getFirebaseClientAuth } from "@/lib/auth/firebase-client";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter(); const [loading, setLoading] = useState(false);
  const logout = async () => { setLoading(true); try { await fetch("/api/v1/auth/session", { method: "DELETE" }); await getFirebaseClientAuth().signOut(); } finally { router.replace("/login"); router.refresh(); setLoading(false); } };
  return <Button variant="ghost" size={compact ? "sm" : "icon"} className={compact ? "w-full justify-start" : undefined} onClick={logout} disabled={loading} title="Sign out"><LogOut className="size-4" /><span>{compact ? (loading ? "Signing out…" : "Sign out") : <span className="sr-only">Sign out</span>}</span></Button>;
}
