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
          const userSnap = await getDoc(userRef);

          const baseData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            photoURL: firebaseUser.photoURL || "",
          };

          // CRITICAL FIX: Create user document if it doesn't exist
          if (!userSnap.exists()) {
            console.log("[Auth] Creating new user document in Firestore");
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
            // Optional: Update displayName/photo if changed in Auth
            const existingData = userSnap.data();
            if (existingData.displayName !== baseData.displayName || 
                existingData.photoURL !== baseData.photoURL) {
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
                subscriptionStatus: data.subscriptionStatus === "active" ? "active" : "inactive",
              };

              console.log("🔥 [Auth] Real-time update → Plan =", updatedUser.plan, 
                         "| Status =", updatedUser.subscriptionStatus);

              setUser({ ...updatedUser }); // Force new object reference
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