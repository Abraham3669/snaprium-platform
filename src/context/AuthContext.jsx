// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeSnapshotRef = useRef(null);

  const updateUser = useCallback((newUserData) => {
    setUser((prev) => {
      const updated = { ...prev, ...newUserData };
      console.log("🔥 [Auth] Setting new user state → Plan =", updated.plan, "| Status =", updated.subscriptionStatus);
      return updated;
    });
  }, []);

  useEffect(() => {
    console.log("[Auth] Starting onAuthStateChanged listener...");

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
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

          if (!userSnap.exists()) {
            console.log("[Auth] Creating new free user");
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

          // Real-time listener
          unsubscribeSnapshotRef.current = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();

              const updatedUser = {
                ...baseData,
                ...data,
                plan: data.plan || "free",
                subscriptionStatus: data.subscriptionStatus === "active" ? "active" : "inactive",
              };

              updateUser(updatedUser);
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
  }, [updateUser]);

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