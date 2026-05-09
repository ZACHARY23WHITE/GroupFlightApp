"use client";

import { signInWithPopup } from "firebase/auth";
import {
  firebaseClientConfigErrorMessage,
  getAppleProvider,
  getFacebookProvider,
  getFirebaseAuth,
  getGoogleProvider,
  isFirebaseClientConfigured,
} from "@/lib/firebase-client";
import { messageForFirebaseAuthError } from "@/lib/map-firebase-auth-error";

type Props = {
  disabled: boolean;
  onError: (message: string) => void;
};

export function SocialSignInButtons({ disabled, onError }: Props) {
  const run = async (kind: "google" | "facebook" | "apple") => {
    if (!isFirebaseClientConfigured()) {
      onError(firebaseClientConfigErrorMessage());
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      onError("Could not start sign-in.");
      return;
    }
    try {
      if (kind === "google") {
        await signInWithPopup(auth, getGoogleProvider());
      } else if (kind === "facebook") {
        await signInWithPopup(auth, getFacebookProvider());
      } else {
        await signInWithPopup(auth, getAppleProvider());
      }
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e
          ? String((e as { code?: string }).code)
          : "";
      if (code === "auth/popup-closed-by-user") return;
      onError(messageForFirebaseAuthError(e));
    }
  };

  const btnClass =
    "flex w-full items-center justify-center rounded-xl border border-stone-200 bg-white py-3 text-sm font-semibold text-stone-800 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50 disabled:opacity-45";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        className={btnClass}
        onClick={() => void run("google")}
      >
        Continue with Google
      </button>
      <button
        type="button"
        disabled={disabled}
        className={btnClass}
        onClick={() => void run("facebook")}
      >
        Continue with Facebook
      </button>
      <button
        type="button"
        disabled={disabled}
        className={btnClass}
        onClick={() => void run("apple")}
      >
        Continue with Apple
      </button>
    </div>
  );
}
