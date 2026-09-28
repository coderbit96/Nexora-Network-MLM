import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { PageTransition } from "@/components/shared/page-transition";

export default function PublicLayout({ children }: { children: React.ReactNode }) { return <><PublicHeader /><main id="main-content" className="mx-auto w-full max-w-[88rem] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><PageTransition>{children}</PageTransition></main><PublicFooter /></>; }
