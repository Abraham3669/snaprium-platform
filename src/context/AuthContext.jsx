// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[Auth] Starting auth listener...");

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[Auth] onAuthStateChanged triggered. User:", firebaseUser ? firebaseUser.uid : "null");

      if (firebaseUser) {
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          console.log("[Auth] Fetching user doc for UID:", firebaseUser.uid);

          // First, get initial data
          const userSnap = await getDoc(userRef);

          let userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            photoURL: firebaseUser.photoURL || "",
            createdAt: new Date().toISOString(),
          };

          if (!userSnap.exists()) {
            console.log("[Auth] No document found → Creating new user document");
            await setDoc(userRef, {
              ...userData,
              plan: "free",
              subscriptionStatus: "inactive",
              uploadCount: 0,
              lastUpload: null,
              solves: 0,
            });
            console.log("[Auth] New user document created with plan: free");
          } else {
            console.log("[Auth] Document exists → Loading data");
            userData = { ...userData, ...userSnap.data() };
          }

          // Set initial user
          setUser(userData);

          // === REAL-TIME LISTENER (This fixes the main issue) ===
          const unsubscribeSnapshot = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const freshData = snapshot.data();
              const updatedUser = {
                ...userData,
                ...freshData,
                // Standardize plan field (Paddle updates "plan")
                plan: freshData.plan || freshData.subscription || "free",
                subscriptionStatus: freshData.subscriptionStatus || "inactive",
              };

              setUser(updatedUser);
              console.log("[Auth] 🔥 Real-time update from Firestore - New Plan:", updatedUser.plan);
            }
          });

          // Cleanup function for snapshot listener
          return () => {
            console.log("[Auth] Cleaning up Firestore snapshot listener");
            unsubscribeSnapshot();
          };

        } catch (error) {
          console.error("[Auth] Firestore error:", error);
          setUser(null);
        }
      } else {
        console.log("[Auth] No user signed in");
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      console.log("[Auth] Auth listener unsubscribed");
      unsubscribeAuth();
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