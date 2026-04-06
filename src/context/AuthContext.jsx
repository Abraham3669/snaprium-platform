// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeSnapshotRef = useRef(null);

  useEffect(() => {
    console.log("[Auth] Starting onAuthStateChanged listener...");

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up any existing snapshot listener before setting a new one
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }

      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);

        try {
          const userSnap = await getDoc(userRef);

          let baseData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            photoURL: firebaseUser.photoURL || "",
          };

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              ...baseData,
              plan: "free",
              subscriptionStatus: "inactive",
              uploadCount: 0,
              solves: 0,
            });
          }

          // Real-time listener
          unsubscribeSnapshotRef.current = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();

              const updatedUser = {
                ...baseData,
                ...data,
                // Force "plan" to be the source of truth (keeps your existing logic)
                plan: data.plan || data.subscription || "free",
                // Fixed subscriptionStatus logic - was broken with truthy strings like "inactive"
                subscriptionStatus: (data.subscriptionStatus === "active" || !!data.subscription) ? "active" : "inactive",
              };

              console.log("🔥 [Auth] Real-time update! Plan =", updatedUser.plan, "| Status =", updatedUser.subscriptionStatus);

              // Direct set with a brand new object reference (this was the main cause of missed UI updates)
              // No more functional update with stale prev + no artificial delay needed
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
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
      }
    };
  }, []);

  const signOutUser = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("[Auth] Sign out failed:", error);
    }
  };

  const value = { user, loading, signOutUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};