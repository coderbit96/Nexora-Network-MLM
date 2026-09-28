"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getFirebaseClientAuth } from "@/lib/auth/firebase-client";

export function LogoutButton() {
  const router = useRouter(); const [loading, setLoading] = useState(false);
  const logout = async () => { setLoading(true); try { await fetch("/api/v1/auth/session", { method: "DELETE" }); await getFirebaseClientAuth().signOut(); } finally { router.replace("/login"); router.refresh(); setLoading(false); } };
  return <Button variant="ghost" size="icon" onClick={logout} disabled={loading} title="Sign out"><LogOut className="size-4" /><span className="sr-only">Sign out</span></Button>;
}
