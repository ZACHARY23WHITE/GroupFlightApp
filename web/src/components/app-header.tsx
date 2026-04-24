"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  const onHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-3xl items-center px-4 sm:h-14 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-stone-900 transition-colors hover:text-rose-700"
        >
          {onHome ? (
            <span className="font-[family-name:var(--font-source-serif)] text-base font-normal">
              Gather
            </span>
          ) : (
            <span className="text-rose-600 underline-offset-4 hover:text-rose-700 hover:underline">
              ← Home
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
