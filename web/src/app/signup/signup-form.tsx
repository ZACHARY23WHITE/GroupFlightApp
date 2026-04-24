"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "@/components/auth-provider";
import { SocialSignInButtons } from "@/components/social-sign-in-buttons";
import {
  firebaseClientConfigErrorMessage,
  getFirebaseAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase-client";
import { messageForFirebaseAuthError } from "@/lib/map-firebase-auth-error";
import { safeReturnPath } from "@/lib/safe-return-path";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-stone-900 shadow-sm placeholder:text-stone-400 transition-colors focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/80";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get("next"));
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    router.replace(next);
  }, [authLoading, user, router, next]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (password !== password2) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        setError("Use at least 6 characters for your password.");
        return;
      }
      if (!isFirebaseClientConfigured()) {
        setError(firebaseClientConfigErrorMessage());
        return;
      }
      const auth = getFirebaseAuth();
      if (!auth) {
        setError("Could not create an account.");
        return;
      }
      setBusy(true);
      try {
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        router.replace(next);
      } catch (err) {
        setError(messageForFirebaseAuthError(err));
      } finally {
        setBusy(false);
      }
    },
    [email, password, password2, router, next]
  );

  const blockForm = authLoading || !!user;

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
          Create an account
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-stone-500">
          Set a password you can reuse to sign in on any device. You can also
          use Google, Facebook, or Apple—your profile is created the same way.
        </p>

        {error ? (
          <p
            className="mt-6 rounded-xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

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
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-stone-700">Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
              minLength={6}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-stone-700">Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className={inputClass}
              required
              minLength={6}
            />
          </label>
          <button
            type="submit"
            disabled={busy || blockForm}
            className="rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-stone-200" />
          </div>
          <div className="relative flex justify-center text-xs font-medium uppercase tracking-wider text-stone-400">
            <span className="bg-stone-50 px-3">Or</span>
          </div>
        </div>

        <SocialSignInButtons
          disabled={busy || blockForm}
          onError={(msg) => setError(msg)}
        />

        <p className="mt-8 text-center text-sm text-stone-600">
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-semibold text-rose-600 underline-offset-4 hover:text-rose-700 hover:underline"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-6 text-center">
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
