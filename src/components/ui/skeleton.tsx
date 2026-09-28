import { cn } from "@/lib/utils/cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/80", className)} aria-hidden="true" {...props} />;
}

export { Skeleton };
