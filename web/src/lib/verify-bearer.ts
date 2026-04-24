import * as admin from "firebase-admin";
import { getFirestoreDb } from "@/lib/firebase-server";

/** Returns Firebase Auth uid from Authorization: Bearer <idToken>, or null. */
export async function verifyBearerUid(req: Request): Promise<string | null> {
  getFirestoreDb();
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
