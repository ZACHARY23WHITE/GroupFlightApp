// Pip — Gathr's paper-plane mascot.
// Shared across the app: header, onboarding, auth screens.

const INK = "#0F1419";

export function Pip({
  size = 80,
  mood = "happy",
  tilt = 0,
  accent = "#e11d48",
}: {
  size?: number;
  mood?: "happy" | "cheer" | "wink" | "sleep";
  tilt?: number;
  accent?: string;
}) {
  const eyes =
    mood === "sleep" ? (
      <>
        <path d="M28 41 Q31 39 34 41" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M44 41 Q47 39 50 41" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ) : mood === "wink" ? (
      <>
        <circle cx="31" cy="41" r="2.2" fill={INK} />
        <path d="M44 41 Q47 39 50 41" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="31" cy="41" r="2.2" fill={INK} />
        <circle cx="47" cy="41" r="2.2" fill={INK} />
      </>
    );

  const mouth =
    mood === "cheer" ? (
      <path d="M34 48 Q39 54 44 48" stroke={INK} strokeWidth="1.8" fill="#FF8B7A" strokeLinejoin="round" />
    ) : mood === "sleep" ? (
      <path d="M36 48 Q39 50 42 48" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    ) : (
      <path d="M34 47 Q39 51 44 47" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    );

  return (
    <div
      style={{
        width: size,
        height: size,
        transform: `rotate(${tilt}deg)`,
        display: "inline-block",
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 80 80" width={size} height={size}>
        <ellipse cx="40" cy="74" rx="22" ry="3" fill={INK} opacity="0.12" />
        <polygon points="8,38 72,18 40,55" fill="#FFFFFF" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <polygon points="40,55 72,18 56,58" fill="#F0E9DD" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <polygon points="40,55 56,58 44,68" fill={accent} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <ellipse cx="25" cy="46" rx="3" ry="2" fill={accent} opacity="0.45" />
        <ellipse cx="53" cy="46" rx="3" ry="2" fill={accent} opacity="0.45" />
        {eyes}
        {mouth}
      </svg>
    </div>
  );
}

export function PaperPlane({
  size = 28,
  accent = "#e11d48",
}: {
  size?: number;
  accent?: string;
}) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} style={{ display: "block" }}>
      <polygon points="3,15 29,4 16,22" fill="#FFFFFF" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="16,22 29,4 22,24" fill="#F0E9DD" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="16,22 22,24 17,28" fill={accent} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

// Compact logo lockup — Pip + wordmark — used in header and auth screens.
export function GathrLogo({
  size = 28,
  fontSize = 18,
  accent = "#e11d48",
}: {
  size?: number;
  fontSize?: number;
  accent?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-plus-jakarta-sans), system-ui, sans-serif",
        fontSize,
        fontWeight: 800,
        letterSpacing: -0.5,
        color: INK,
        lineHeight: 1,
      }}
    >
      <Pip size={size} mood="happy" tilt={-10} accent={accent} />
      Gathr
    </span>
  );
}
