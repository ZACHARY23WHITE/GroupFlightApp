"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import {
  firebaseClientConfigErrorMessage,
  getFirebaseAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase-client";
import { messageForFirebaseAuthError } from "@/lib/map-firebase-auth-error";
import { safeReturnPath } from "@/lib/safe-return-path";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-stone-900 shadow-sm placeholder:text-stone-400 transition-colors focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/80";

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!isFirebaseClientConfigured()) {
        setError(firebaseClientConfigErrorMessage());
        return;
      }
      const auth = getFirebaseAuth();
      if (!auth) {
        setError("Could not send reset email.");
        return;
      }
      setBusy(true);
      try {
        await sendPasswordResetEmail(auth, email.trim());
        setSent(true);
      } catch (err) {
        const code =
          err && typeof err === "object" && "code" in err
            ? String((err as { code?: string }).code)
            : "";
        if (code === "auth/user-not-found") {
          setSent(true);
        } else {
          setError(messageForFirebaseAuthError(err));
        }
      } finally {
        setBusy(false);
      }
    },
    [email]
  );

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_50%_-15%,rgb(255_228_230/0.45),transparent)]"
        aria-hidden
      />
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
          Gather
        </p>
        <h1 className="mt-3 text-center font-[family-name:var(--font-source-serif)] text-2xl font-normal tracking-tight text-stone-900">
          Reset password
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-stone-500">
          We&apos;ll email you a link to choose a new password. You need access
          to the inbox for this to work.
        </p>

        <section className="mt-6 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm leading-relaxed text-amber-950">
          <p className="font-semibold text-amber-900">Lost access to your email?</p>
          <p className="mt-2 text-amber-900/90">
            Password reset only works if you can still open that mailbox. If
            you previously signed in with Google, Facebook, or Apple, try that
            button on the sign-in page instead—it may still work even if your
            email changed. Otherwise, create a new account with a reachable
            email; your old guest data on this browser can be merged when you
            sign in if the same device still has it.
          </p>
        </section>

        {error ? (
          <p
            className="mt-6 rounded-xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {sent ? (
          <p
            className="mt-6 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm leading-relaxed text-stone-700 shadow-sm"
            role="status"
          >
            If an account exists for that email, we sent a reset link. Check
            your inbox and spam. For privacy, we don&apos;t confirm whether the
            address was found.
          </p>
        ) : (
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="mt-6 flex flex-col gap-4"
          >
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-stone-700">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm">
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-semibold text-rose-600 underline-offset-4 hover:text-rose-700 hover:underline"
          >
            Back to sign in
          </Link>
        </p>

        <p className="mt-4 text-center">
          <Link
            href="/"
            className="text-sm font-semibold text-stone-500 underline-offset-4 hover:text-stone-800 hover:underline"
          >
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
