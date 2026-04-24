"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { HangarInboundDoodle } from "@/components/hangar-inbound-doodle";

/**
 * Full-screen loading state: hangar animation + message. Use on any submit / long wait.
 */
export function SubmitHangarOverlay({
  open,
  message,
}: {
  open: boolean;
  message: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-stone-50/95 px-5 pb-16 pt-12 backdrop-blur-[8px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_35%,rgb(255_228_230/0.35),transparent)]"
        aria-hidden
      />
      <div className="relative flex w-full max-w-md flex-col items-center">
        <HangarInboundDoodle className="max-w-md" />
        <p className="mt-6 max-w-sm text-center font-[family-name:var(--font-source-serif)] text-lg font-normal leading-snug text-stone-800 sm:text-xl">
          {message}
        </p>
        <p className="mt-3 text-center text-xs font-medium tracking-wide text-stone-400">
          Paper flights inbound
        </p>
      </div>
    </div>,
    document.body
  );
}
