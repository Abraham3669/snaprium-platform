import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function ensureUserDocument(firebaseUser) {
  if (!firebaseUser?.uid) {
    console.error("[userProfile] no uid");
    return null;
  }

  const userRef = doc(db, "users", firebaseUser.uid);

  try {
    const existing = await getDoc(userRef);
    if (existing.exists()) {
      await setDoc(
        userRef,
        {
          email: firebaseUser.email || existing.data().email || "",
          displayName:
            firebaseUser.displayName ||
            existing.data().displayName ||
            "User",
          photoURL: firebaseUser.photoURL || existing.data().photoURL || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log("[userProfile] exists, not resetting limits", firebaseUser.uid);
      return existing;
    }
  } catch (e) {
    console.warn("[userProfile] getDoc failed", e.code, e.message);
  }

  await setDoc(
    userRef,
    {
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
    },
    { merge: true }
  );

  console.log("[userProfile] created", firebaseUser.uid);
  return true;
}