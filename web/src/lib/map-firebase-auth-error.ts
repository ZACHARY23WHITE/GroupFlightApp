function readAuthError(err: unknown): { code: string; message: string } {
  let code = "";
  let message = "";
  if (err instanceof Error) message = err.message ?? "";
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code?: unknown }).code;
    if (typeof c === "string") code = c;
  }
  return { code, message };
}

/** Maps Firebase Auth failures to copy users can act on. Pass the caught value, not only `code`. */
export function messageForFirebaseAuthError(err: unknown): string {
  const { code, message } = readAuthError(err);

  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn’t look valid.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email or password doesn’t match our records.";
    case "auth/email-already-in-use":
      return "An account already exists with this email. Try signing in instead.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 6 characters).";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow popups for this site.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/operation-not-allowed":
      return "This sign-in method isn’t enabled. In Firebase Console → Authentication → Sign-in method, turn on Email/Password (and Google/Facebook/Apple if you use them).";
    case "auth/unauthorized-domain":
      return "This site’s domain isn’t allowed for Firebase Auth. In Firebase Console → Authentication → Settings → Authorized domains, add the exact host you use (e.g. localhost, 127.0.0.1, or your computer’s LAN IP if you open the app from a phone on Wi‑Fi).";
    case "auth/invalid-api-key":
      return "The Firebase Web API key doesn’t match this project or isn’t valid. Recheck NEXT_PUBLIC_FIREBASE_API_KEY in .env and restart the dev server.";
    case "auth/configuration-not-found":
      return "Authentication isn’t set up for this Firebase project yet. In Firebase Console open Build → Authentication: if you see “Get started”, complete that first. Then open Sign-in method and enable Email/Password (required for password sign-up). Add Google etc. if you use those buttons.";
    case "auth/configuration":
    case "auth/project-not-found":
      return "Firebase can’t reach this project. Confirm NEXT_PUBLIC_FIREBASE_PROJECT_ID matches your Firebase project and restart `npm run dev`.";
    case "auth/internal-error":
      return "Firebase returned an internal error. Try again shortly; if it keeps happening, check https://status.firebase.google.com/ and your project quotas.";
    case "auth/cancelled-popup-request":
      return "Another sign-in window was already open. Close extra tabs and try once.";
    default:
      if (code.startsWith("auth/")) {
        return `Could not complete sign-in (${code}). Check Firebase Authentication: sign-in methods enabled and this site’s domain listed under Authorized domains.`;
      }
      if (message && !/^firebase error:/i.test(message)) {
        return message;
      }
      return "Something went wrong. Try again.";
  }
}
