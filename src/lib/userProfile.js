import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

function newUserPayload(firebaseUser) {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || "",
    displayName:
      firebaseUser.displayName ||
      firebaseUser.email?.split("@")[0] ||
      "User",
    photoURL: firebaseUser.photoURL || "",
    plan: "free",
    subscriptionStatus: "inactive",
    uploadCount: 0,
    solves: 0,
    dailySolves: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function ensureUserDocument(firebaseUser) {
  if (!firebaseUser?.uid) {
    console.error("[userProfile] no uid");
    return null;
  }

  const userRef = doc(db, "users", firebaseUser.uid);

  try {
    const existing = await getDoc(userRef);
    if (existing.exists()) {
      console.log("[userProfile] exists", firebaseUser.uid);
      return existing;
    }
  } catch (e) {
    console.warn("[userProfile] getDoc failed", e.code, e.message);
  }

  try {
    console.log("[userProfile] creating", firebaseUser.uid);
    await setDoc(userRef, newUserPayload(firebaseUser), { merge: true });
    const snap = await getDocFromServer(userRef).catch(() => getDoc(userRef));
    console.log("[userProfile] created", firebaseUser.uid, snap?.exists());
    return snap;
  } catch (e) {
    console.error("[userProfile] setDoc FAILED", e.code, e.message, e);
    throw e;
  }
}