// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeSnapshotRef = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous snapshot listener
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }

      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);

        try {
          const userSnap = await getDoc(userRef);

          const baseData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            photoURL: firebaseUser.photoURL || "",
          };

          // Create user document if it doesn't exist
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              ...baseData,
              plan: "free",
              subscriptionStatus: "inactive",
              uploadCount: 0,
              solves: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            // Sync auth data with Firestore if needed
            const existing = userSnap.data();
            if (existing.displayName !== baseData.displayName || 
                existing.photoURL !== baseData.photoURL) {
              await setDoc(userRef, {
                displayName: baseData.displayName,
                photoURL: baseData.photoURL,
                updatedAt: serverTimestamp(),
              }, { merge: true });
            }
          }

          // Real-time listener
          unsubscribeSnapshotRef.current = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();

              const updatedUser = {
                ...baseData,
                ...data,
                plan: data.plan || "free",
                subscriptionStatus: data.subscriptionStatus || "inactive",
                // Helper flags
                isUnlimited: data.plan === "unlimited",
                isPremium: data.plan === "premium" || data.plan === "unlimited",
              };

              setUser(updatedUser);
            }
          });

        } catch (error) {
          console.error("[Auth] Firestore error:", error);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshotRef.current) unsubscribeSnapshotRef.current();
    };
  }, []);

  const signOutUser = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("[Auth] Sign out failed:", error);
    }
  };

  const value = { 
    user, 
    loading, 
    signOutUser 
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};