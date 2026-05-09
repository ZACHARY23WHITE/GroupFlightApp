"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SubmitHangarOverlay } from "@/components/submit-hangar-overlay";
import { CABIN_OPTIONS } from "@/lib/travel-class";
import { Pip, PaperPlane, GathrLogo } from "@/components/pip";
import {
  dismissOnboardingPrompt,
  fetchProfile,
  markOnboardingDoneLocal,
  markSessionActive,
  saveProfile,
} from "@/lib/profile-client";

// ─── Design tokens ────────────────────────────────────────────────────────
const ACCENT = "#e11d48";
const SKY = "#4A90E2";
const INK = "#0F1419";
const CREAM = "#FBF7F0";

// ─── Airports for typeahead ───────────────────────────────────────────────
type Airport = { code: string; city: string; country: string };
const POPULAR_AIRPORTS: Airport[] = [
  { code: "SFO", city: "San Francisco", country: "USA" },
  { code: "JFK", city: "New York", country: "USA" },
  { code: "LAX", city: "Los Angeles", country: "USA" },
  { code: "ORD", city: "Chicago", country: "USA" },
  { code: "SEA", city: "Seattle", country: "USA" },
  { code: "AUS", city: "Austin", country: "USA" },
  { code: "MIA", city: "Miami", country: "USA" },
  { code: "DEN", city: "Denver", country: "USA" },
  { code: "ATL", city: "Atlanta", country: "USA" },
  { code: "BOS", city: "Boston", country: "USA" },
  { code: "LHR", city: "London", country: "UK" },
  { code: "CDG", city: "Paris", country: "France" },
  { code: "NRT", city: "Tokyo", country: "Japan" },
  { code: "BCN", city: "Barcelona", country: "Spain" },
  { code: "YYZ", city: "Toronto", country: "Canada" },
  { code: "MEX", city: "Mexico City", country: "Mexico" },
  { code: "SYD", city: "Sydney", country: "Australia" },
  { code: "DXB", city: "Dubai", country: "UAE" },
  { code: "AMS", city: "Amsterdam", country: "Netherlands" },
  { code: "SIN", city: "Singapore", country: "Singapore" },
];

// ─── Image helper ─────────────────────────────────────────────────────────
async function fileToJpegDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 512;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("Could not read image.");
  ctx2d.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  let q = 0.88;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > 420_000 && q > 0.45) {
    q -= 0.07;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  return dataUrl;
}

// ─── Destination pin ──────────────────────────────────────────────────────
function DestinationPin({ size = 64, color = ACCENT }: { size?: number; color?: string }) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px dashed ${color}`, opacity: 0.4, animation: "gathr-pin-spin 14s linear infinite" }} />
      <div style={{ position: "absolute", inset: 12, borderRadius: "50%", background: color, opacity: 0.18, animation: "gathr-pin-pulse 2.2s ease-in-out infinite" }} />
      <div style={{ position: "absolute", inset: "40%", borderRadius: "50%", background: color, boxShadow: `0 0 0 4px ${color}33` }} />
    </div>
  );
}

// ─── Converging planes (welcome hero) ────────────────────────────────────
function ConvergingPlanes({ width = 320, height = 260, accent = ACCENT, playKey = 0 }: {
  width?: number; height?: number; accent?: string; playKey?: number;
}) {
  const cx = width / 2;
  const cy = height / 2;
  const planes = [
    { fromX: -60, fromY: 40,          scale: 1.1,  delay: 0,    initR: 20,  midR: 45,  ox: -8, oy: -8 },
    { fromX: width + 40, fromY: 80,   scale: 0.95, delay: 0.25, initR: 195, midR: 225, ox: 8,  oy: -8 },
    { fromX: 20, fromY: height + 40,  scale: 1.0,  delay: 0.5,  initR: -35, midR: -15, ox: -8, oy: 8  },
  ];

  return (
    <div style={{ position: "relative", width, height, pointerEvents: "none" }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
        {planes.map((p, i) => (
          <path key={i}
            d={`M ${p.fromX} ${p.fromY} Q ${(p.fromX + cx) / 2 + (i === 1 ? -30 : 30)} ${(p.fromY + cy) / 2 - 30} ${cx} ${cy}`}
            stroke={accent} strokeWidth="1.5" strokeDasharray="3 5" fill="none" opacity="0.7"
          />
        ))}
      </svg>
      <div style={{ position: "absolute", left: cx - 32, top: cy - 32, animation: "gathr-pin-pop 0.5s 1.0s both" }}>
        <DestinationPin size={64} color={accent} />
      </div>
      {planes.map((p, i) => {
        const name = `gathr-arrive-${playKey}-${i}`;
        return (
          <div key={`${playKey}-${i}`}>
            <div style={{ position: "absolute", left: 0, top: 0, animation: `${name} 1.6s cubic-bezier(.5,.05,.3,1) ${p.delay}s both` }}>
              <PaperPlane size={Math.round(32 * p.scale)} accent={accent} />
            </div>
            <style>{`
              @keyframes ${name} {
                0%   { transform: translate(${p.fromX}px,${p.fromY}px) rotate(${p.initR}deg); opacity:0; }
                15%  { opacity:1; }
                70%  { transform: translate(${cx-16+p.ox}px,${cy-16+p.oy}px) rotate(${p.midR}deg) scale(0.9); opacity:1; }
                100% { transform: translate(${cx-16}px,${cy-16}px) rotate(${p.midR}deg) scale(0); opacity:0; }
              }
            `}</style>
          </div>
        );
      })}
    </div>
  );
}

// ─── Plane streak (between-screen flourish) ───────────────────────────────
function PlaneStreak({ playKey = 0, direction = "lr" }: { playKey?: number; direction?: "lr" | "rl" }) {
  const isLR = direction === "lr";
  const name = `gathr-streak-${playKey}`;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 50 }}>
      <div key={playKey} style={{ position: "absolute", left: "50%", top: "38%", animation: `${name} 0.9s cubic-bezier(.4,.05,.3,1) both` }}>
        <PaperPlane size={24} accent={ACCENT} />
      </div>
      <style>{`
        @keyframes ${name} {
          0%   { transform: translate(${isLR ? "-110vw" : "110vw"}, 0) rotate(${isLR ? 5 : 185}deg); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translate(${isLR ? "110vw" : "-110vw"}, -8px) rotate(${isLR ? 5 : 185}deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Confetti burst ───────────────────────────────────────────────────────
function Confetti({ playKey = 0 }: { playKey?: number }) {
  const colors = [ACCENT, SKY, "#F5C242", "#7BC67B", "#C084FC"];
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: (i / 30) * 100,
    delay: (i * 0.05) % 0.35,
    duration: 1.5 + (i % 5) * 0.28,
    color: colors[i % 5],
    size: 6 + (i % 4) * 2,
    rotate: i * 23,
  }));

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 30 }}>
      {pieces.map((p) => (
        <div key={`${playKey}-${p.id}`} style={{
          position: "absolute", left: `${p.left}%`, top: -12,
          width: p.size, height: p.size * 0.4,
          background: p.color, borderRadius: 1,
          animation: `gathr-confetti-fall ${p.duration}s ${p.delay}s ease-in both`,
          transform: `rotate(${p.rotate}deg)`,
        }} />
      ))}
    </div>
  );
}

// ─── Segmented progress pills ─────────────────────────────────────────────
function SegmentedProgress({ value, total }: { value: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6, flex: 1 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 8, borderRadius: 100,
          background: i <= value ? ACCENT : "rgba(15,20,25,0.10)",
          transition: "background 0.4s",
          boxShadow: i <= value ? "inset 0 -2px 0 rgba(0,0,0,0.15)" : "none",
        }} />
      ))}
    </div>
  );
}

// ─── Speech bubble ────────────────────────────────────────────────────────
function SpeechBubble({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "relative", background: "#fff", borderRadius: 16, padding: "14px 18px",
      border: `2px solid ${INK}`, fontSize: 15, lineHeight: 1.35, fontWeight: 600, color: INK,
      boxShadow: "0 3px 0 rgba(0,0,0,0.85)",
    }}>
      {children}
      <div style={{ position: "absolute", bottom: -10, left: 28, width: 16, height: 16, background: "#fff", border: `2px solid ${INK}`, borderTop: "none", borderLeft: "none", transform: "rotate(45deg)" }} />
      <div style={{ position: "absolute", bottom: -2, left: 22, width: 28, height: 4, background: "#fff" }} />
    </div>
  );
}

// ─── Pip + speech bubble row ──────────────────────────────────────────────
function PipPrompt({ message, mood = "happy" }: { message: string; mood?: "happy" | "cheer" | "wink" | "sleep" }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
      <Pip size={72} mood={mood} tilt={-6} accent={ACCENT} />
      <div style={{ flex: 1, paddingBottom: 14 }}>
        <SpeechBubble>{message}</SpeechBubble>
      </div>
    </div>
  );
}

// ─── Chunky button with bottom shadow ────────────────────────────────────
function GathrButton({ children, onClick, disabled = false, color = INK }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; color?: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", height: 56, borderRadius: 16, border: "none",
        background: disabled ? "#D5D0C6" : color, color: "#fff",
        fontFamily: "inherit", fontSize: 15, fontWeight: 800,
        letterSpacing: 0.5, textTransform: "uppercase",
        boxShadow: pressed || disabled ? "0 0 0 rgba(0,0,0,0.85)" : "0 4px 0 0 rgba(0,0,0,0.85)",
        transform: `translateY(${pressed && !disabled ? 4 : 0}px)`,
        transition: "transform 0.08s, box-shadow 0.08s",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.65 : 1,
      }}
    >{children}</button>
  );
}

// ─── Styled text input ────────────────────────────────────────────────────
function GathrInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(15,20,25,0.55)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{
        borderRadius: 16, border: `2px solid ${focused ? ACCENT : INK}`,
        padding: "10px 16px 8px", background: "#fff",
        boxShadow: focused ? `0 4px 0 ${ACCENT}55` : "0 3px 0 rgba(0,0,0,0.85)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}>
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 16, fontWeight: 600, color: INK, padding: 0 }}
        />
      </div>
    </div>
  );
}

// ─── Step header (back + segmented progress) ──────────────────────────────
function StepHeader({ stepIdx, progressIdx, progressTotal, onBack }: {
  stepIdx: number; progressIdx: number; progressTotal: number; onBack: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "calc(env(safe-area-inset-top, 0px) + 14px) 20px 12px", flexShrink: 0 }}>
      <button type="button" onClick={onBack} disabled={stepIdx === 0} style={{
        background: "transparent", border: "none", padding: 4,
        cursor: stepIdx === 0 ? "default" : "pointer",
        opacity: stepIdx === 0 ? 0.2 : 0.55, flexShrink: 0,
      }}>
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <path d="M9 6l-6 7 6 7M3 13h20" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {progressIdx >= 0 && <SegmentedProgress value={progressIdx} total={progressTotal} />}
    </div>
  );
}

// ─── STEP 0: Welcome carousel ─────────────────────────────────────────────
function StepWelcome({ onNext }: { onNext: () => void }) {
  const [slide, setSlide] = useState(0);
  const [planeKey, setPlaneKey] = useState(0);

  const slides = [
    { title: "Three friends.\nThree cities.\nOne trip.", sub: "Plan group flights into the same place — no spreadsheets needed." },
    { title: "Everyone\nfrom everywhere.", sub: "Add home airports for your crew. We compare per-person fares so no one overpays." },
    { title: "Land\ntogether.", sub: "Share an invite code. Watch the trip take shape as friends join." },
  ];

  function advance() {
    if (slide < slides.length - 1) {
      setPlaneKey((k) => k + 1);
      setSlide((s) => s + 1);
    } else {
      onNext();
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      {/* Skip */}
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 18px)", right: 22, zIndex: 10 }}>
        <button type="button" onClick={onNext} style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "rgba(15,20,25,0.45)", textTransform: "uppercase", letterSpacing: 0.6 }}>
          Skip
        </button>
      </div>

      {/* Wordmark */}
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 16px)", left: 22, zIndex: 10 }}>
        <GathrLogo size={30} fontSize={18} accent={ACCENT} />
      </div>

      {/* Hero */}
      <div style={{ height: "50%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", background: `linear-gradient(180deg, ${CREAM} 0%, #F5EDE0 100%)` }}>
        <ConvergingPlanes width={340} height={260} accent={ACCENT} playKey={planeKey} />
        {slide === 0 && (
          <div style={{ position: "absolute", right: 18, bottom: 14, animation: "gathr-pip-bob 3s ease-in-out infinite" }}>
            <Pip size={68} mood="happy" tilt={-12} accent={ACCENT} />
          </div>
        )}
      </div>

      {/* Copy + dots + CTA */}
      <div style={{ flex: 1, padding: "24px 28px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div key={slide} style={{ animation: "gathr-slide-in-right 0.35s both" }}>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 36, lineHeight: 1.0, letterSpacing: -1.2, color: INK, whiteSpace: "pre-line", fontWeight: 400, marginBottom: 14 }}>
            {slides[slide].title}
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.5, color: "rgba(15,20,25,0.6)" }}>
            {slides[slide].sub}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            {slides.map((_, i) => (
              <button type="button" key={i} onClick={() => { setSlide(i); setPlaneKey((k) => k + 1); }} style={{ width: i === slide ? 28 : 10, height: 10, borderRadius: 5, background: i === slide ? ACCENT : "rgba(15,20,25,0.15)", border: "none", cursor: "pointer", transition: "all 0.25s" }} />
            ))}
          </div>
          <GathrButton onClick={advance} color={ACCENT}>
            {slide < slides.length - 1 ? "Next →" : "Get started"}
          </GathrButton>
        </div>
      </div>
    </div>
  );
}

// ─── STEP 1: Name + photo ─────────────────────────────────────────────────
function StepAboutYou({
  stepIdx, progressIdx, progressTotal,
  displayName, setDisplayName,
  profilePhotoDataUrl, setProfilePhotoDataUrl,
  onBack, onNext, error,
}: {
  stepIdx: number; progressIdx: number; progressTotal: number;
  displayName: string; setDisplayName: (v: string) => void;
  profilePhotoDataUrl: string | null; setProfilePhotoDataUrl: (v: string | null) => void;
  onBack: () => void; onNext: () => void; error: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgError, setImgError] = useState<string | null>(null);

  const handlePhoto = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setImgError(null);
    try {
      const url = await fileToJpegDataUrl(file);
      if (url.length > 480_000) { setImgError("Photo is too large. Try a smaller image."); return; }
      setProfilePhotoDataUrl(url);
    } catch { setImgError("Could not use that image. Try a JPG or PNG."); }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <StepHeader stepIdx={stepIdx} progressIdx={progressIdx} progressTotal={progressTotal} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 22px 0", display: "flex", flexDirection: "column", gap: 20 }}>
        <PipPrompt message="What should we call you?" mood="happy" />

        {/* Photo picker */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button type="button" onClick={() => fileRef.current?.click()} style={{
            width: 96, height: 96, borderRadius: "50%", border: `3px dashed ${ACCENT}`,
            background: profilePhotoDataUrl ? "transparent" : `${ACCENT}12`,
            cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {profilePhotoDataUrl ? (
              <img src={profilePhotoDataUrl} alt="Profile preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ textAlign: "center", color: ACCENT }}>
                <div style={{ fontSize: 24 }}>📷</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>Add photo</div>
              </div>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => void handlePhoto(e.target.files)} />
        </div>
        {profilePhotoDataUrl && (
          <div style={{ textAlign: "center" }}>
            <button type="button" onClick={() => setProfilePhotoDataUrl(null)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "rgba(15,20,25,0.5)" }}>
              Remove photo
            </button>
          </div>
        )}
        {imgError && <p style={{ fontSize: 13, color: "#C0392B", textAlign: "center", margin: 0 }}>{imgError}</p>}

        <GathrInput label="Your name" value={displayName} onChange={setDisplayName} placeholder="Alex Rivera" />
        {error && <p style={{ fontSize: 13, color: "#C0392B", fontWeight: 500, margin: 0 }}>{error}</p>}
        <div style={{ height: 8 }} />
      </div>
      <div style={{ padding: "14px 22px calc(env(safe-area-inset-bottom, 0px) + 20px)", flexShrink: 0 }}>
        <GathrButton onClick={onNext} disabled={displayName.trim().length < 2} color={ACCENT}>Continue</GathrButton>
      </div>
    </div>
  );
}

// ─── STEP 2: Contact ──────────────────────────────────────────────────────
function StepContact({
  stepIdx, progressIdx, progressTotal,
  email, setEmail, phone, setPhone,
  smsUpdatesOptIn, setSmsUpdatesOptIn,
  onBack, onNext,
}: {
  stepIdx: number; progressIdx: number; progressTotal: number;
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  smsUpdatesOptIn: boolean; setSmsUpdatesOptIn: (v: boolean) => void;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <StepHeader stepIdx={stepIdx} progressIdx={progressIdx} progressTotal={progressTotal} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 22px 0", display: "flex", flexDirection: "column", gap: 20 }}>
        <PipPrompt message="How can we reach you? (optional)" mood="happy" />
        <GathrInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
        <GathrInput label="Phone" type="tel" value={phone} onChange={setPhone} placeholder="+1 (555) 000-0000" />

        {/* SMS opt-in */}
        <label style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", background: "#fff", border: `2px solid ${smsUpdatesOptIn ? ACCENT : INK}`, borderRadius: 16, boxShadow: "0 3px 0 rgba(0,0,0,0.85)", cursor: "pointer", transition: "border-color 0.15s" }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${smsUpdatesOptIn ? ACCENT : INK}`, background: smsUpdatesOptIn ? ACCENT : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.15s" }}>
            {smsUpdatesOptIn && <svg width="13" height="13" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <input type="checkbox" checked={smsUpdatesOptIn} onChange={(e) => setSmsUpdatesOptIn(e.target.checked)} style={{ display: "none" }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>Text me trip updates</div>
            <div style={{ fontSize: 13, color: "rgba(15,20,25,0.6)", marginTop: 2 }}>Only for trips you're in. No spam, ever.</div>
          </div>
        </label>

        <div style={{ padding: "12px 14px", borderRadius: 14, background: `${SKY}12`, border: `2px solid ${SKY}`, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 18 }}>🔒</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: INK }}>We only use your contact info for trip invites. Never sold.</div>
        </div>
        <div style={{ height: 8 }} />
      </div>
      <div style={{ padding: "14px 22px calc(env(safe-area-inset-bottom, 0px) + 20px)", flexShrink: 0 }}>
        <GathrButton onClick={onNext} color={ACCENT}>Continue</GathrButton>
      </div>
    </div>
  );
}

// ─── STEP 3: Travel defaults ──────────────────────────────────────────────
function StepTravelDefaults({
  stepIdx, progressIdx, progressTotal,
  homeAirport, setHomeAirport, setHomeCity,
  familyAdults, setFamilyAdults,
  familyChildren, setFamilyChildren,
  preferredCabin, setPreferredCabin,
  onBack, onNext, error,
}: {
  stepIdx: number; progressIdx: number; progressTotal: number;
  homeAirport: string; setHomeAirport: (v: string) => void; setHomeCity: (v: string) => void;
  familyAdults: number; setFamilyAdults: (v: number) => void;
  familyChildren: number; setFamilyChildren: (v: number) => void;
  preferredCabin: string; setPreferredCabin: (v: string) => void;
  onBack: () => void; onNext: () => void; error: string | null;
}) {
  const [query, setQuery] = useState(homeAirport);

  const filtered = POPULAR_AIRPORTS.filter(
    (a) => !query.trim() || a.code.toLowerCase().includes(query.toLowerCase()) || a.city.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);

  const cabins = [
    { id: "economy",         label: "Economy", emoji: "💺" },
    { id: "premium_economy", label: "Premium", emoji: "✨" },
    { id: "business",        label: "Business", emoji: "🥂" },
    { id: "first",           label: "First",    emoji: "👑" },
  ];

  const valid = /^[A-Z]{3}$/.test(homeAirport.trim().toUpperCase());

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <StepHeader stepIdx={stepIdx} progressIdx={progressIdx} progressTotal={progressTotal} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 22px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <PipPrompt message="Where do you fly from?" mood="wink" />

        {/* Airport search */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `2px solid ${INK}`, borderRadius: 14, padding: "12px 14px", boxShadow: "0 3px 0 rgba(0,0,0,0.85)" }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="8" cy="8" r="6" stroke={INK} strokeWidth="2" fill="none" /><path d="M13 13l3 3" stroke={INK} strokeWidth="2" strokeLinecap="round" /></svg>
          <input
            value={query}
            onChange={(e) => {
              const val = e.target.value.toUpperCase().slice(0, 3);
              setQuery(val);
              if (/^[A-Z]{3}$/.test(val)) {
                const found = POPULAR_AIRPORTS.find((a) => a.code === val);
                setHomeAirport(val);
                setHomeCity(found?.city ?? "");
              } else {
                setHomeAirport("");
              }
            }}
            placeholder="Search city or airport code (e.g. SEA)"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: INK, letterSpacing: query.length === 3 ? 2 : 0 }}
          />
        </div>

        {/* Airport list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((a) => {
            const sel = homeAirport === a.code;
            return (
              <button type="button" key={a.code} onClick={() => { setHomeAirport(a.code); setHomeCity(a.city); setQuery(a.code); }} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                border: `2px solid ${sel ? ACCENT : INK}`,
                background: sel ? `${ACCENT}14` : "#fff",
                cursor: "pointer", borderRadius: 14, fontFamily: "inherit", textAlign: "left",
                boxShadow: sel ? `0 3px 0 ${ACCENT}` : "0 3px 0 rgba(0,0,0,0.85)",
                transition: "all 0.15s",
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: sel ? ACCENT : INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, letterSpacing: 0.5, flexShrink: 0, transition: "background 0.15s" }}>
                  {a.code}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{a.city}</div>
                  <div style={{ fontSize: 12, color: "rgba(15,20,25,0.55)", fontWeight: 500 }}>{a.country}</div>
                </div>
                {sel && (
                  <svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="11" fill={ACCENT} /><path d="M6 11l3.5 3.5L16 7.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Party size */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(15,20,25,0.55)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Party size</div>
          <div style={{ background: "#fff", border: `2px solid ${INK}`, borderRadius: 16, padding: 16, boxShadow: "0 3px 0 rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", gap: 14 }}>
            {([
              { label: "Adults", value: familyAdults, min: 1, max: 9, set: setFamilyAdults },
              { label: "Children", value: familyChildren, min: 0, max: 8, set: setFamilyChildren },
            ] as { label: string; value: number; min: number; max: number; set: (v: number) => void }[]).map(({ label, value, min, max, set }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <button type="button" onClick={() => set(Math.max(min, value - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: `2px solid ${INK}`, background: "#fff", cursor: "pointer", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 0 rgba(0,0,0,0.85)" }}>−</button>
                  <div style={{ fontSize: 18, fontWeight: 800, color: INK, minWidth: 24, textAlign: "center" }}>{value}</div>
                  <button type="button" onClick={() => set(Math.min(max, value + 1))} style={{ width: 32, height: 32, borderRadius: 8, border: `2px solid ${INK}`, background: "#fff", cursor: "pointer", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 0 rgba(0,0,0,0.85)" }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cabin class */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(15,20,25,0.55)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Preferred cabin</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {cabins.map((c) => {
              const sel = preferredCabin === c.id;
              return (
                <button type="button" key={c.id} onClick={() => setPreferredCabin(c.id)} style={{
                  padding: "12px 4px", borderRadius: 14,
                  border: `2px solid ${sel ? ACCENT : INK}`,
                  background: sel ? `${ACCENT}14` : "#fff",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: INK,
                  cursor: "pointer",
                  boxShadow: sel ? `0 3px 0 ${ACCENT}` : "0 3px 0 rgba(0,0,0,0.85)",
                  transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
                }}>
                  <span style={{ fontSize: 20 }}>{c.emoji}</span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p style={{ fontSize: 13, color: "#C0392B", fontWeight: 500, margin: 0 }}>{error}</p>}
        <div style={{ height: 8 }} />
      </div>
      <div style={{ padding: "14px 22px calc(env(safe-area-inset-bottom, 0px) + 20px)", flexShrink: 0 }}>
        <GathrButton onClick={onNext} disabled={!valid} color={ACCENT}>Continue</GathrButton>
      </div>
    </div>
  );
}

// ─── STEP 4: Done / celebration ───────────────────────────────────────────
function StepDone({ displayName, homeAirport, familyAdults, familyChildren, preferredCabin, busy, error, onFinish }: {
  displayName: string; homeAirport: string; familyAdults: number; familyChildren: number;
  preferredCabin: string; busy: boolean; error: string | null; onFinish: () => void;
}) {
  const [confettiKey, setConfettiKey] = useState(0);
  useEffect(() => { const t = setTimeout(() => setConfettiKey((k) => k + 1), 200); return () => clearTimeout(t); }, []);

  const cabinLabel = CABIN_OPTIONS.find((o) => o.value === preferredCabin)?.label ?? "Economy";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <Confetti playKey={confettiKey} />
      <div style={{ flex: 1, padding: "calc(env(safe-area-inset-top, 0px) + 36px) 22px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, overflowY: "auto" }}>
        <div style={{ animation: "gathr-pip-cheer 0.6s 0.1s both" }}>
          <Pip size={120} mood="cheer" tilt={0} accent={ACCENT} />
        </div>
        <div style={{ alignSelf: "flex-start", width: "100%" }}>
          <SpeechBubble>{"You're in! Let's plan your first trip. ✈️"}</SpeechBubble>
        </div>
        <div style={{ textAlign: "center", width: "100%" }}>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 38, lineHeight: 1.0, letterSpacing: -1.2, color: INK, fontWeight: 400, marginBottom: 6 }}>
            {"Welcome,\n"}<span>{displayName.trim() || "friend"}.</span>
          </div>
        </div>

        {/* Summary card */}
        <div style={{ width: "100%", background: "#fff", border: `2px solid ${INK}`, borderRadius: 18, padding: 18, boxShadow: "0 4px 0 rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", gap: 12 }}>
          {homeAirport && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "rgba(15,20,25,0.6)", fontWeight: 500 }}>Home airport</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: INK, letterSpacing: 1 }}>{homeAirport}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "rgba(15,20,25,0.6)", fontWeight: 500 }}>Party</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>
              {familyAdults} adult{familyAdults !== 1 ? "s" : ""}
              {familyChildren > 0 ? `, ${familyChildren} child${familyChildren !== 1 ? "ren" : ""}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "rgba(15,20,25,0.6)", fontWeight: 500 }}>Cabin</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>{cabinLabel}</span>
          </div>
        </div>

        {error && <p style={{ fontSize: 13, color: "#C0392B", fontWeight: 500, margin: 0, width: "100%" }}>{error}</p>}
        <div style={{ height: 12 }} />
      </div>
      <div style={{ padding: "14px 22px calc(env(safe-area-inset-bottom, 0px) + 24px)", flexShrink: 0 }}>
        <GathrButton onClick={onFinish} disabled={busy} color={ACCENT}>
          {busy ? "Saving…" : "Start planning →"}
        </GathrButton>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────
export function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return")?.trim() || "/";
  const preview = searchParams.get("preview") === "1";
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(0);
  const [transitionKey, setTransitionKey] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsUpdatesOptIn, setSmsUpdatesOptIn] = useState(false);
  const [homeAirport, setHomeAirport] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [familyAdults, setFamilyAdults] = useState(2);
  const [familyChildren, setFamilyChildren] = useState(0);
  const [preferredCabin, setPreferredCabin] = useState("economy");

  const STEP_COUNT = 5;
  const progressTotal = 3;
  const progressIdx = step >= 1 && step <= 3 ? step - 1 : -1;

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(`/login?next=${encodeURIComponent("/onboarding")}`); return; }
    if (!preview) {
      void (async () => {
        const p = await fetchProfile();
        if (p?.onboardingCompletedAt) router.replace("/");
      })();
    }
  }, [authLoading, user, router]);

  const goNext = useCallback(() => {
    setError(null);
    setDirection("forward");
    setTransitionKey((k) => k + 1);
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  }, []);

  const goBack = useCallback(() => {
    setError(null);
    setDirection("back");
    setTransitionKey((k) => k + 1);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const validateAndNext = useCallback(() => {
    setError(null);
    if (step === 1 && displayName.trim().length < 2) {
      setError("Add your name so your group knows who you are.");
      return;
    }
    if (step === 3 && !/^[A-Z]{3}$/.test(homeAirport.trim().toUpperCase())) {
      setError("Select a home airport from the list, or type a valid 3-letter code.");
      return;
    }
    goNext();
  }, [step, displayName, homeAirport, goNext]);

  const finish = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await saveProfile({
      displayName,
      email: email.trim() || user?.email || "",
      phone,
      homeAirport: homeAirport.trim().toUpperCase(),
      homeCity,
      familyAdults,
      familyChildren,
      preferredCabin,
      profilePhotoDataUrl,
      smsUpdatesOptIn,
      markOnboardingComplete: true,
    });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    markOnboardingDoneLocal();
    markSessionActive();
    dismissOnboardingPrompt();
    router.push(returnTo.startsWith("/") ? returnTo : "/");
  }, [displayName, email, phone, homeAirport, homeCity, familyAdults, familyChildren, preferredCabin, profilePhotoDataUrl, smsUpdatesOptIn, router, returnTo, user?.email]);

  if (authLoading || !user) {
    return <SubmitHangarOverlay open message={authLoading ? "Loading…" : "Redirecting to sign in…"} />;
  }

  function renderStep() {
    switch (step) {
      case 0: return <StepWelcome onNext={goNext} />;
      case 1: return (
        <StepAboutYou
          stepIdx={step} progressIdx={progressIdx} progressTotal={progressTotal}
          displayName={displayName} setDisplayName={setDisplayName}
          profilePhotoDataUrl={profilePhotoDataUrl} setProfilePhotoDataUrl={setProfilePhotoDataUrl}
          onBack={goBack} onNext={validateAndNext} error={error}
        />
      );
      case 2: return (
        <StepContact
          stepIdx={step} progressIdx={progressIdx} progressTotal={progressTotal}
          email={email} setEmail={setEmail} phone={phone} setPhone={setPhone}
          smsUpdatesOptIn={smsUpdatesOptIn} setSmsUpdatesOptIn={setSmsUpdatesOptIn}
          onBack={goBack} onNext={goNext}
        />
      );
      case 3: return (
        <StepTravelDefaults
          stepIdx={step} progressIdx={progressIdx} progressTotal={progressTotal}
          homeAirport={homeAirport} setHomeAirport={setHomeAirport} setHomeCity={setHomeCity}
          familyAdults={familyAdults} setFamilyAdults={setFamilyAdults}
          familyChildren={familyChildren} setFamilyChildren={setFamilyChildren}
          preferredCabin={preferredCabin} setPreferredCabin={setPreferredCabin}
          onBack={goBack} onNext={validateAndNext} error={error}
        />
      );
      case 4: return (
        <StepDone
          displayName={displayName} homeAirport={homeAirport}
          familyAdults={familyAdults} familyChildren={familyChildren} preferredCabin={preferredCabin}
          busy={busy} error={error} onFinish={() => void finish()}
        />
      );
      default: return null;
    }
  }

  return (
    <>
      <div style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: CREAM,
        fontFamily: "var(--font-plus-jakarta-sans), system-ui, sans-serif",
        color: INK, overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        {/* Screen content with slide transition */}
        <div
          key={transitionKey}
          style={{
            flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
            animation: step > 0
              ? `${direction === "forward" ? "gathr-slide-in-right" : "gathr-slide-in-left"} 0.45s cubic-bezier(.2,.7,.3,1) both`
              : undefined,
          }}
        >
          {renderStep()}
        </div>

        {/* Plane streak between steps */}
        {step > 0 && step < 4 && (
          <PlaneStreak key={transitionKey} playKey={transitionKey} direction={direction === "forward" ? "lr" : "rl"} />
        )}
      </div>

      <SubmitHangarOverlay open={busy} message="Saving your profile…" />
    </>
  );
}
