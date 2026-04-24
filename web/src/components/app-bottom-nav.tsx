"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { TripActionsSheet } from "@/components/trip-actions-sheet";

function hideBottomNav(pathname: string | null): boolean {
  if (!pathname) return true;
  return (
    pathname.startsWith("/onboarding") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password"
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-6 w-6 ${active ? "text-rose-600" : "text-stone-400"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-6 w-6 ${active ? "text-rose-600" : "text-stone-400"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function ExploreIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-6 w-6 ${active ? "text-rose-600" : "text-stone-400"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

export function AppBottomNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (hideBottomNav(pathname)) return null;

  const onHome = pathname === "/";
  const onProfile =
    pathname === "/profile" || pathname.startsWith("/profile/");
  const onExplore = pathname === "/explore";

  return (
    <>
      <TripActionsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200/90 bg-stone-50/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgb(15_15_15/0.06)] backdrop-blur-md"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="mx-auto max-w-lg px-0.5 pt-1 sm:px-1">
          <div className="grid grid-cols-4 items-end gap-0">
            <Link
              href="/"
              className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg py-2 transition-colors ${
                onHome ? "text-rose-600" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <HomeIcon active={onHome} />
              <span className="text-[10px] font-semibold tracking-wide">
                Trips
              </span>
            </Link>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-rose-600 text-2xl font-light leading-none text-white shadow-lg shadow-rose-900/25 transition-transform hover:scale-105 active:scale-95"
                aria-label="Create new trip or join with a code"
              >
                <span aria-hidden>+</span>
              </button>
            </div>

            <Link
              href="/explore"
              className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg py-2 transition-colors ${
                onExplore
                  ? "text-rose-600"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <ExploreIcon active={onExplore} />
              <span className="max-w-[4.5rem] text-center text-[10px] font-semibold leading-tight tracking-wide">
                Explore options
              </span>
            </Link>

            <Link
              href="/profile"
              className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg py-2 transition-colors ${
                onProfile
                  ? "text-rose-600"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <ProfileIcon active={onProfile} />
              <span className="text-[10px] font-semibold tracking-wide">
                Profile
              </span>
            </Link>
          </div>
        </div>
        <div className="h-2 shrink-0" aria-hidden />
      </nav>
    </>
  );
}
