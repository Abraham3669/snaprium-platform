// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
  serverTimestamp,
  enableNetwork,
} from "firebase/firestore";
import { showAppError } from "../utils/errorReporter";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

const AuthContext = createContext();

function buildUser(firebaseUser, data = {}) {
  const plan = data.plan || "free";
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || data.email || "",
    displayName:
      data.displayName ||
      firebaseUser.displayName ||
      firebaseUser.email?.split("@")[0] ||
      "User",
    photoURL: data.photoURL || firebaseUser.photoURL || "",
    ...data,
    plan,
    subscriptionStatus: data.subscriptionStatus || "inactive",
    isUnlimited: plan === "unlimited",
    isPremium: ["premium", "unlimited"].includes(plan),
  };
}

function baseProfile(firebaseUser) {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || "",
    displayName:
      firebaseUser.displayName ||
      firebaseUser.email?.split("@")[0] ||
      "User",
    photoURL: firebaseUser.photoURL || "",
  };
}

/** Always ensure users/{uid} exists in Firestore (critical for APK) */
async function ensureUserDocument(firebaseUser) {
  const userRef = doc(db, "users", firebaseUser.uid);
  const base = baseProfile(firebaseUser);

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      try {
        await enableNetwork(db);
      } catch (_) {}

      // Existence check — do NOT require server (offline-safe)
      let snap = null;
      try {
        snap = await getDoc(userRef);
      } catch (e) {
        console.warn("[Auth] getDoc failed, will try setDoc merge:", e?.message);
      }

      if (snap && snap.exists()) {
        const existing = snap.data();
        // Sync name/photo if changed
        if (
          existing.displayName !== base.displayName ||
          existing.photoURL !== base.photoURL ||
          existing.email !== base.email
        ) {
          await setDoc(
            userRef,
            {
              displayName: base.displayName,
              photoURL: base.photoURL,
              email: base.email,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
        return snap;
      }

      // CREATE new user document (merge: true is safe if race)
      console.log(`[Auth] Creating Firestore user doc (attempt ${attempt}):`, firebaseUser.uid);
      await setDoc(
        userRef,
        {
          ...base,
          plan: "free",
          subscriptionStatus: "inactive",
          uploadCount: 0,
          solves: 0,
          dailySolves: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Confirm
      try {
        return await getDocFromServer(userRef);
      } catch {
        return await getDoc(userRef);
      }
    } catch (err) {
      console.warn(`[Auth] ensureUserDocument attempt ${attempt} failed:`, err?.message || err);
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  console.error("[Auth] Failed to create user document after retries");
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeSnapshotRef = useRef(null);
  const firebaseUserRef = useRef(null);
  const pollTimerRef = useRef(null);

  const fetchUserFromServer = useCallback(async (firebaseUser) => {
    if (!firebaseUser) return null;

    try {
      await enableNetwork(db);
    } catch (_) {}

    const userRef = doc(db, "users", firebaseUser.uid);

    try {
      const snap = await getDocFromServer(userRef);
      if (snap.exists()) return buildUser(firebaseUser, snap.data());
    } catch (_) {
      const snap = await getDoc(userRef);
      if (snap.exists()) return buildUser(firebaseUser, snap.data());
    }
    return null;
  }, []);

  const refreshUser = useCallback(async () => {
    const firebaseUser = firebaseUserRef.current || auth.currentUser;
    if (!firebaseUser) return null;

    try {
      // If doc missing, create it, then read
      await ensureUserDocument(firebaseUser);
      const next = await fetchUserFromServer(firebaseUser);
      if (next) {
        setUser(next);
        console.log("[Auth] refreshUser plan:", next.plan, "uid:", next.uid);
        return next;
      }
    } catch (e) {
      console.warn("[Auth] refreshUser failed:", e);
    }
    return null;
  }, [fetchUserFromServer]);

  const startPlanPoll = useCallback(() => {
    if (!Capacitor.isNativePlatform()) return;

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    let ticks = 0;
    refreshUser();

    pollTimerRef.current = setInterval(async () => {
      ticks += 1;
      const next = await refreshUser();
      if (next?.plan === "unlimited" || ticks >= 18) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }, 5000);
  }, [refreshUser]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }

      firebaseUserRef.current = firebaseUser;

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", firebaseUser.uid);

      try {
        if (Capacitor.isNativePlatform()) {
          try {
            await enableNetwork(db);
          } catch (e) {
            console.warn("enableNetwork:", e);
          }
        }

        // ALWAYS try to create the Firestore profile first (fixes APK)
        const userSnap = await ensureUserDocument(firebaseUser);

        if (userSnap?.exists()) {
          setUser(buildUser(firebaseUser, userSnap.data()));
        } else {
          // Local fallback only if network still can't write
          setUser(
            buildUser(firebaseUser, {
              plan: "free",
              subscriptionStatus: "inactive",
            })
          );
        }

        // Live updates
        unsubscribeSnapshotRef.current = onSnapshot(
          userRef,
          { includeMetadataChanges: true },
          (snapshot) => {
            if (!snapshot.exists()) {
              // Doc missing → try create again
              ensureUserDocument(firebaseUser);
              return;
            }
            const next = buildUser(firebaseUser, snapshot.data());
            setUser(next);
            if (!snapshot.metadata.fromCache) {
              console.log("[Auth] server snapshot plan:", next.plan);
            }
          },
          (error) => {
            if (
              error?.message?.includes("offline") ||
              error?.code === "unavailable"
            ) {
              return;
            }
            showAppError("Auth Snapshot Listener", error);
          }
        );
      } catch (error) {
        console.error("[Auth] Firestore init error:", error);
        if (
          !error?.message?.includes("offline") &&
          error?.code !== "unavailable"
        ) {
          showAppError("Auth Firestore Init", error);
        }
        setUser(
          buildUser(firebaseUser, {
            plan: "free",
            subscriptionStatus: "inactive",
          })
        );
      }

      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshotRef.current) unsubscribeSnapshotRef.current();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle;
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        console.log("[Auth] app resumed → ensure user + poll plan");
        startPlanPoll();
      }
    }).then((h) => {
      handle = h;
    });

    return () => {
      if (handle?.remove) handle.remove();
    };
  }, [startPlanPoll]);

  const signOutUser = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      showAppError("Sign Out", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signOutUser, refreshUser, startPlanPoll }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};