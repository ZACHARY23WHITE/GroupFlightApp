"use client";

import { useId } from "react";

/**
 * Paper planes glide into a large hangar and fade inside — loops forever.
 * Styles: `.hangar-inbound-doodle` in globals.css (hld-*).
 */
export function HangarInboundDoodle({
  className = "",
}: {
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const gHangar = `hldHangarShade-${uid}`;
  const gInterior = `hldInterior-${uid}`;

  return (
    <div
      className={`hangar-inbound-doodle relative mx-auto w-full max-w-lg select-none px-2 ${className}`}
    >
      <svg
        viewBox="0 0 400 240"
        className="h-[min(42dvh,19rem)] w-full sm:h-[min(44dvh,22rem)]"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <linearGradient id={gHangar} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(120 113 108 / 0.14)" />
            <stop offset="100%" stopColor="rgb(120 113 108 / 0.28)" />
          </linearGradient>
          <linearGradient id={gInterior} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="rgb(68 64 60 / 0.12)" />
            <stop offset="100%" stopColor="rgb(68 64 60 / 0.35)" />
          </linearGradient>
        </defs>

        {/* Ground & runway */}
        <path
          d="M 12 202 L 388 202"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeDasharray="6 5"
          className="text-stone-400/90"
        />
        <path
          d="M 12 208 L 388 208"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.1}
          strokeLinecap="round"
          className="text-stone-300/80"
        />

        {/* Hangar shell (large arch) */}
        <path
          d="M 44 206 L 44 72 Q 200 14 356 72 L 356 206 L 44 206 Z"
          fill={`url(#${gHangar})`}
          stroke="currentColor"
          strokeWidth={1.65}
          strokeLinejoin="round"
          className="text-stone-500"
        />
        {/* Interior depth */}
        <path
          d="M 108 200 Q 200 52 292 200 Z"
          fill={`url(#${gInterior})`}
          className="text-stone-600"
        />

        {/* Soft trails */}
        <g
          className="text-stone-300/75"
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeLinecap="round"
          strokeDasharray="3 6"
        >
          <path d="M -20 215 Q 80 160 188 108" className="hld-trail hld-trail--1" />
          <path d="M 420 198 Q 310 130 215 102" className="hld-trail hld-trail--2" />
          <path d="M 180 248 Q 195 170 202 108" className="hld-trail hld-trail--3" />
          <path d="M 95 235 Q 150 150 192 105" className="hld-trail hld-trail--4" />
          <path d="M 330 228 Q 260 145 218 100" className="hld-trail hld-trail--5" />
        </g>

        <PaperPlane groupClass="hld-plane hld-plane--1" className="text-rose-600" />
        <PaperPlane groupClass="hld-plane hld-plane--2" className="text-rose-500" />
        <PaperPlane groupClass="hld-plane hld-plane--3" className="text-rose-600/92" />
        <PaperPlane groupClass="hld-plane hld-plane--4" className="text-rose-500/88" />
        <PaperPlane groupClass="hld-plane hld-plane--5" className="text-rose-600/85" />

        {/* Door arch & jambs in front of planes */}
        <path
          d="M 108 200 Q 200 52 292 200"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.85}
          strokeLinecap="round"
          className="text-stone-600"
        />
        <path
          d="M 102 202 L 106 198 M 298 202 L 294 198"
          stroke="currentColor"
          strokeWidth={1.35}
          strokeLinecap="round"
          className="text-stone-500"
        />
        <path
          d="M 96 203 L 304 203"
          stroke="currentColor"
          strokeWidth={1.2}
          strokeLinecap="round"
          className="text-stone-400/70"
        />
      </svg>
    </div>
  );
}

function PaperPlane({
  groupClass,
  className,
}: {
  groupClass: string;
  className: string;
}) {
  return (
    <g className={`${groupClass} ${className}`}>
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M 7.5 0 L -6.2 -4.8 L -3 0 L -6.2 4.8 Z"
          fill="currentColor"
          fillOpacity={0.14}
          stroke="currentColor"
          strokeWidth={1.45}
        />
        <path
          d="M 6.5 0 L -5.5 0"
          fill="none"
          stroke="currentColor"
          strokeWidth={0.8}
          opacity={0.42}
        />
        <path
          d="M -6 -2.9 L -6 2.9"
          fill="none"
          stroke="currentColor"
          strokeWidth={0.85}
          opacity={0.32}
        />
      </g>
    </g>
  );
}
