// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ref to store the snapshot unsubscribe function
  const unsubscribeSnapshotRef = useRef(null);

  // 1. Auth State Listener
  useEffect(() => {
    console.log("[Auth] Starting onAuthStateChanged listener...");

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[Auth] onAuthStateChanged →", firebaseUser ? firebaseUser.uid : "No user");

      // Clean up previous snapshot listener if exists
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }

      if (firebaseUser) {
        try {
          const userRef = doc(db, "users", firebaseUser.uid);

          // Initial load
          const userSnap = await getDoc(userRef);
          let userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            photoURL: firebaseUser.photoURL || "",
            createdAt: new Date().toISOString(),
          };

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              ...userData,
              plan: "free",
              subscriptionStatus: "inactive",
              uploadCount: 0,
              lastUpload: null,
              solves: 0,
            });
            console.log("[Auth] New user document created (plan: free)");
          } else {
            userData = { ...userData, ...userSnap.data() };
          }

          // Set initial user
          setUser({
            ...userData,
            plan: userData.plan || userData.subscription || "free",
          });

          console.log("[Auth] Initial user loaded → Plan:", userData.plan || "free");

          // 2. Real-time Firestore Listener (this is the fix)
          console.log("[Auth] Setting up real-time onSnapshot listener...");
          unsubscribeSnapshotRef.current = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const freshData = snapshot.data();
              const updatedUser = {
                ...userData,
                ...freshData,
                plan: freshData.plan || freshData.subscription || "free",
                subscriptionStatus: freshData.subscriptionStatus || "inactive",
              };

              setUser(updatedUser);
              console.log("🔥 [Auth] Real-time Firestore update! New plan =", updatedUser.plan);
            }
          });

        } catch (error) {
          console.error("[Auth] Firestore error:", error);
          setUser(null);
        }
      } else {
        // User signed out
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      console.log("[Auth] Cleaning up auth listener");
      unsubscribeAuth();
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
      }
    };
  }, []);

  const signOutUser = async () => {
    try {
      await auth.signOut();
      console.log("[Auth] Sign out successful");
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