"use client";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState title="This administration page could not be loaded" description="Your data was not changed. Try loading the page again." action={<Button type="button" variant="outline" onClick={reset}>Try again</Button>} />;
}
