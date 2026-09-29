import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = { status: string; className?: string };

const success = new Set(["ACTIVE", "APPROVED", "COMPLETED", "SUCCESS", "PAID", "DELIVERED", "SHIPPED"]);
const warning = new Set(["PENDING", "PROCESSING", "CREATED", "PAYMENT_PENDING", "INACTIVE"]);
const destructive = new Set(["FAILED", "REJECTED", "CANCELLED", "REFUNDED", "DISABLED", "SUSPENDED", "VOID", "REVERSED"]);

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.replaceAll("_", " ");
  const variant = success.has(status) ? "success" : warning.has(status) ? "warning" : destructive.has(status) ? "destructive" : "secondary";
  return <Badge className={className} variant={variant}>{normalized}</Badge>;
}
