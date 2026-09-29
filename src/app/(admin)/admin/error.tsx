"use client";

import { ErrorState } from "@/components/shared/states";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState title="This administration page could not be loaded" description="Your data was not changed. Try loading the page again." action={<button type="button" className="text-sm font-semibold text-primary underline-offset-4 hover:underline" onClick={reset}>Try again</button>} />;
}
