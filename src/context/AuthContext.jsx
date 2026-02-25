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
    console.log("Auth listener starting...");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("onAuthStateChanged fired → user:", firebaseUser ? firebaseUser.uid : "null");

      if (firebaseUser) {
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          let userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            photoURL: firebaseUser.photoURL || "",
            createdAt: new Date().toISOString(),
          };

          if (!userSnap.exists()) {
            console.log("Creating new user doc in Firestore for UID:", firebaseUser.uid);
            await setDoc(userRef, userData);
            console.log("Firestore user doc created successfully");
          } else {
            console.log("User doc already exists, merging data");
            userData = { ...userData, ...userSnap.data() };
          }

          setUser(userData);
          console.log("User state updated in context:", userData.uid);
        } catch (error) {
          console.error("Firestore user creation/fetch error:", error);
          setUser(null); // fallback
        }
      } else {
        console.log("User signed out");
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      console.log("Auth listener unsubscribing");
      unsubscribe();
    };
  }, []);

  const signOutUser = async () => {
    try {
      await auth.signOut();
      console.log("Sign out successful");
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const value = { user, loading, signOutUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};