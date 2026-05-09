"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GathrLogo } from "@/components/pip";

function hideHeader(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/onboarding") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password"
  );
}

export function AppHeader() {
  const pathname = usePathname();

  if (hideHeader(pathname)) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-3xl items-center px-4 sm:h-14 sm:px-6">
        <Link href="/" aria-label="Gathr home">
          <GathrLogo size={30} fontSize={17} />
        </Link>
      </div>
    </header>
  );
}
