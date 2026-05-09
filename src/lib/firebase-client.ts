"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  getAuth,
  type Auth,
} from "firebase/auth";

/**
 * Read each var with a literal `process.env.NEXT_PUBLIC_*` access so Next.js
 * can inline values into the client bundle (dynamic `process.env[k]` stays empty).
 */
function firebaseClientEnvSnapshot(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

/** Keys that are set but empty (trimmed). */
export function missingFirebaseClientEnvKeys(): string[] {
  const snap = firebaseClientEnvSnapshot();
  return (Object.keys(snap) as (keyof typeof snap)[]).filter(
    (k) => !snap[k]?.trim()
  );
}

export function isFirebaseClientConfigured(): boolean {
  return missingFirebaseClientEnvKeys().length === 0;
}

/** User-facing message listing any missing `NEXT_PUBLIC_FIREBASE_*` env vars. */
export function firebaseClientConfigErrorMessage(): string {
  const missing = missingFirebaseClientEnvKeys();
  const list =
    missing.length > 0
      ? ` Missing or empty: ${missing.join(", ")}.`
      : "";
  return `Firebase client is not fully configured.${list} Copy the Web app config from Firebase Console → Project settings → Your apps, add it to .env, then restart \`npm run dev\`.`;
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseClientConfigured()) return null;
  if (getApps().length > 0) {
    return getApps()[0]!;
  }
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getAuth(app);
}

export function getGoogleProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
}

export function getFacebookProvider(): FacebookAuthProvider {
  return new FacebookAuthProvider();
}

export function getAppleProvider(): OAuthProvider {
  const p = new OAuthProvider("apple.com");
  p.addScope("email");
  p.addScope("name");
  return p;
}
