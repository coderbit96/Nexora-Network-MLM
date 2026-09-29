import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return <div className="space-y-4" aria-label="Loading content" aria-busy="true"><Skeleton className="h-8 w-52" /><Skeleton className="h-5 w-96 max-w-full" /><div className="rounded-xl border p-4"><Skeleton className="h-10 w-full" /><div className="mt-5 space-y-3">{Array.from({ length: rows }, (_, row) => <div className="grid gap-3" key={row} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{Array.from({ length: columns }, (_, column) => <Skeleton key={column} className="h-5" />)}</div>)}</div></div></div>;
}
