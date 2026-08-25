// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  enableNetwork,
} from "firebase/firestore";
import { showAppError } from "../utils/errorReporter";
import { Capacitor } from "@capacitor/core";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeSnapshotRef = useRef(null);

  // Helper that retries when Firestore says "offline"
  const getDocWithRetry = async (ref, maxRetries = 4) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await getDoc(ref);
      } catch (err) {
        const isOffline =
          err?.message?.includes("offline") ||
          err?.code === "unavailable" ||
          err?.code === "failed-precondition";

        if (isOffline && attempt < maxRetries) {
          console.log(`[Auth] Firestore offline – retry ${attempt}/${maxRetries}`);
          // Force network back on
          try {
            await enableNetwork(db);
          } catch (_) {}
          await new Promise((r) => setTimeout(r, 600 * attempt));
          continue;
        }
        throw err;
      }
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean previous listener
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", firebaseUser.uid);

      try {
        // On native always try to turn network on
        if (Capacitor.isNativePlatform()) {
          try {
            await enableNetwork(db);
          } catch (e) {
            console.warn("enableNetwork:", e);
          }
        }

        const userSnap = await getDocWithRetry(userRef);

        const baseData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          displayName:
            firebaseUser.displayName ||
            firebaseUser.email?.split("@")[0] ||
            "User",
          photoURL: firebaseUser.photoURL || "",
        };

        if (!userSnap.exists()) {
          console.log(`[Auth] Creating user document ${firebaseUser.uid}`);
          await setDoc(userRef, {
            ...baseData,
            plan: "free",
            subscriptionStatus: "inactive",
            uploadCount: 0,
            solves: 0,
            dailySolves: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const existing = userSnap.data();
          if (
            existing.displayName !== baseData.displayName ||
            existing.photoURL !== baseData.photoURL
          ) {
            await setDoc(
              userRef,
              {
                displayName: baseData.displayName,
                photoURL: baseData.photoURL,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        }

        // Real-time listener
        unsubscribeSnapshotRef.current = onSnapshot(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              setUser({
                ...baseData,
                ...data,
                plan: data.plan || "free",
                subscriptionStatus: data.subscriptionStatus || "inactive",
                isUnlimited: data.plan === "unlimited",
                isPremium: ["premium", "unlimited"].includes(data.plan),
              });
            }
          },
          (error) => {
            // Ignore temporary offline errors completely
            if (
              error?.message?.includes("offline") ||
              error?.code === "unavailable"
            ) {
              console.warn("[Auth] Snapshot temporary offline – ignored");
              return;
            }
            showAppError("Auth Snapshot Listener", error);
          }
        );
      } catch (error) {
        console.error("[Auth] Firestore init error:", error);

        // Only show the error if it is NOT an offline problem
        if (
          !error?.message?.includes("offline") &&
          error?.code !== "unavailable"
        ) {
          showAppError("Auth Firestore Init", error);
        }

        // Never leave the user as null – give a basic object so the app works
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName || "User",
          photoURL: firebaseUser.photoURL || "",
          plan: "free",
          subscriptionStatus: "inactive",
          isUnlimited: false,
          isPremium: false,
        });
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
      showAppError("Sign Out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};