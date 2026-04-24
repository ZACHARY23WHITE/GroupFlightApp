import * as admin from "firebase-admin";

function resolveProjectId(): string | undefined {
  const fromEnv = process.env.FIREBASE_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  const raw = process.env.FIREBASE_CONFIG;
  if (!raw) return undefined;
  try {
    const c = JSON.parse(raw) as { projectId?: string };
    const id = c.projectId?.trim();
    return id || undefined;
  } catch {
    return undefined;
  }
}

/** Named `firebase-server` so this file does not shadow the `firebase-admin` npm package. */
function initFirebaseAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  const projectId = resolveProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  try {
    const options =
      projectId != null && projectId !== ""
        ? { credential: admin.credential.applicationDefault(), projectId }
        : { credential: admin.credential.applicationDefault() };
    return admin.initializeApp(options);
  } catch {
    throw new Error(
      "Firebase Admin is not configured. For local dev, set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY from a Firebase service account JSON (Console → Project settings → Service accounts → Generate new private key). On Firebase App Hosting / Cloud Run, Application Default Credentials apply; set FIREBASE_PROJECT_ID if the project is not detected."
    );
  }
}

export function getFirestoreDb(): admin.firestore.Firestore {
  initFirebaseAdminApp();
  return admin.firestore();
}
