import type { SVGProps } from "react";

import { cn } from "@/lib/utils/cn";

/** A compact network mark: three verified connections flowing toward one destination. */
export function NexoraMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false" className={cn("shrink-0", className)} {...props}>
    <rect width="48" height="48" rx="14" fill="#3157D5" />
    <path d="M15.25 17.25 24 12.5l8.75 4.75v9.5L24 31.5l-8.75-4.75v-9.5Z" stroke="white" strokeWidth="2.25" strokeLinejoin="round" />
    <path d="M15.25 17.25 24 22l8.75-4.75M24 22v9.5" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="13" cy="32.5" r="3.25" fill="#A8FF71" stroke="#3157D5" strokeWidth="1.5" />
    <path d="M15.5 30.5 20.25 27.75" stroke="#A8FF71" strokeWidth="2" strokeLinecap="round" />
    <circle cx="35" cy="32.5" r="3.25" fill="#A8FF71" stroke="#3157D5" strokeWidth="1.5" />
    <path d="m32.5 30.5-4.75-2.75" stroke="#A8FF71" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
