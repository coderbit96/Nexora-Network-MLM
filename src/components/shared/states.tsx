import { AlertCircle, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div role="status" className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/25 p-6 text-center sm:p-8"><div className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Inbox className="size-5" aria-hidden="true" /></div><h3 className="font-semibold tracking-tight">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

export function ErrorState({ title = "Something went wrong", description = "We could not load this content. Please try again.", action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return <div role="alert" className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/60 p-6 text-center sm:p-8"><div className="mb-4 grid size-11 place-items-center rounded-xl bg-red-100 text-red-700"><AlertCircle className="size-5" aria-hidden="true" /></div><h3 className="font-semibold text-red-950">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-red-800">{description}</p>{action ? <div className="mt-5">{action}</div> : <Button className="mt-5" variant="outline" onClick={() => window.location.reload()}>Try again</Button>}</div>;
}
