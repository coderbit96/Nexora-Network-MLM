import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() { return <main className="mx-auto max-w-7xl space-y-6 p-6"><Skeleton className="h-8 w-56" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div><Skeleton className="h-64" /></main>; }
