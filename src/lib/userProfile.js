import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("firestore-timeout")), ms)
    ),
  ]);
}

export async function ensureUserDocument(firebaseUser) {
  if (!firebaseUser?.uid) {
    console.error("[userProfile] no uid");
    return null;
  }

  try {
    if (auth.authStateReady) {
      await withTimeout(auth.authStateReady(), 8000);
    }
    if (auth.currentUser) {
      await withTimeout(auth.currentUser.getIdToken(true), 8000);
    }
  } catch (e) {
    console.warn("[userProfile] auth/token", e.message || e);
  }

  const uid = auth.currentUser?.uid || firebaseUser.uid;
  const userRef = doc(db, "users", uid);

  try {
    const existing = await withTimeout(getDoc(userRef), 5000);
    if (existing.exists()) {
      await withTimeout(
        setDoc(
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
        ),
        5000
      );
      console.log("[userProfile] exists, not resetting limits", uid);
      return existing;
    }
  } catch (e) {
    console.warn("[userProfile] getDoc failed", e.code || "", e.message || e);
  }

  try {
    await withTimeout(
      setDoc(
        userRef,
        {
          uid,
          email: firebaseUser.email || auth.currentUser?.email || "",
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
      ),
      10000
    );
    console.log("[userProfile] created", uid);
    return true;
  } catch (e) {
    console.error("[userProfile] setDoc failed", e.code || "", e.message || e);
    return null;
  }
}