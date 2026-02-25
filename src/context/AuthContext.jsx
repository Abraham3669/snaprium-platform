// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[Auth] Starting listener...");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[Auth] onAuthStateChanged triggered. User:", firebaseUser ? firebaseUser.uid : "null");

      if (firebaseUser) {
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          console.log("[Auth] Checking Firestore doc for UID:", firebaseUser.uid);

          const userSnap = await getDoc(userRef);

          let userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            photoURL: firebaseUser.photoURL || "",
            createdAt: new Date().toISOString(),
          };

          if (!userSnap.exists()) {
            console.log("[Auth] No doc exists → creating new user document...");
            await setDoc(userRef, {
              ...userData,
              uploadCount: 0,           // ← added here
              lastUpload: null,         // ← optional, tracks last upload time
            });
            console.log("[Auth] User document CREATED successfully in Firestore with uploadCount: 0");
          } else {
            console.log("[Auth] Doc already exists → loading existing data");
            userData = { ...userData, ...userSnap.data() };
          }

          setUser(userData);
          console.log("[Auth] User state SET in context:", userData.uid);
        } catch (error) {
          console.error("[Auth] Firestore error during user setup:", error.code, error.message);
          setUser(null);
        }
      } else {
        console.log("[Auth] User signed out");
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      console.log("[Auth] Listener unsubscribed");
      unsubscribe();
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