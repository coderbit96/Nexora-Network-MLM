import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AuthNotReady({ title, description }: { title: string; description: string }) { return <><p className="text-sm font-semibold text-primary">Account access</p><h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1><p className="mt-3 text-muted-foreground">{description}</p><Card className="mt-8"><CardContent className="p-6"><ShieldCheck className="size-6 text-primary" /><p className="mt-4 text-sm leading-6 text-muted-foreground">Authentication screens are intentionally not interactive until Firebase configuration and the secure account-registration workflow are delivered.</p></CardContent></Card><Button className="mt-6" variant="outline" asChild><Link href="/">Return home</Link></Button></>; }
