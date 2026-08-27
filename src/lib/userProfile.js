import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function ensureUserDocument(firebaseUser) {
  if (!firebaseUser?.uid) {
    console.error("[userProfile] no uid");
    return null;
  }

  const userRef = doc(db, "users", firebaseUser.uid);

  const payload = {
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

  console.log("[userProfile] writing", firebaseUser.uid, payload.email);
  await setDoc(userRef, payload, { merge: true });
  console.log("[userProfile] write ok", firebaseUser.uid);
  return true;
}