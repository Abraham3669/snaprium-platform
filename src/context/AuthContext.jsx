// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeSnapshotRef = useRef(null);

  useEffect(() => {
    console.log("[Auth] Starting onAuthStateChanged listener...");

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous listener
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }

      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);

        try {
          // Only read once on auth change — do NOT write unless truly new user
          const userSnap = await getDoc(userRef);

          const baseData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            photoURL: firebaseUser.photoURL || "",
          };

          if (!userSnap.exists()) {
            // Only create default free user if it truly doesn't exist
            console.log("[Auth] Creating new free user doc");
            // We use setDoc with merge: false (default) only for new users
            await setDoc(userRef, {
              ...baseData,
              plan: "free",
              subscriptionStatus: "inactive",
              uploadCount: 0,
              solves: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          // Real-time listener (this is the source of truth)
          unsubscribeSnapshotRef.current = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();

              const updatedUser = {
                ...baseData,
                ...data,
                plan: data.plan || "free",                    // plan from Firestore is source of truth
                subscriptionStatus: data.subscriptionStatus === "active" ? "active" : "inactive",
              };

              console.log("🔥 [Auth] Real-time update! Plan =", updatedUser.plan, 
                         "| Status =", updatedUser.subscriptionStatus, 
                         "| paddleSubscriptionId =", data.paddleSubscriptionId || "none");

              setUser(updatedUser);   // Always set fresh object
            } else {
              console.warn("[Auth] User doc disappeared!");
              setUser(null);
            }
          }, (error) => {
            console.error("[Auth] onSnapshot error:", error);
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

  const value = { user, loading, signOutUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};