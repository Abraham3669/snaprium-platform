import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocFromServer, onSnapshot } from "firebase/firestore";
import { showAppError } from "../utils/errorReporter";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { ensureUserDocument } from "../lib/userProfile";

const AuthContext = createContext();

function buildUser(firebaseUser, data = {}) {
  const plan = data.plan || "free";
  const banned = data.banned === true;
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
    banned,
    isBanned: banned,
    subscriptionStatus: data.subscriptionStatus || "inactive",
    isUnlimited: plan === "unlimited",
    isPremium: ["premium", "unlimited"].includes(plan),
  };
}


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubSnapRef = useRef(null);
  const firebaseUserRef = useRef(null);

  const fetchUserFromServer = useCallback(async (firebaseUser) => {
    if (!firebaseUser) return null;
    const userRef = doc(db, "users", firebaseUser.uid);
    try {
      const snap = await getDocFromServer(userRef);
      if (snap.exists()) return buildUser(firebaseUser, snap.data());
    } catch {
      const snap = await getDoc(userRef).catch(() => null);
      if (snap?.exists()) return buildUser(firebaseUser, snap.data());
    }
    return null;
  }, []);

  const refreshUser = useCallback(async () => {
    const firebaseUser = firebaseUserRef.current || auth.currentUser;
    if (!firebaseUser) return null;
    try {
      await ensureUserDocument(firebaseUser);
      const next = await fetchUserFromServer(firebaseUser);
      if (next) {
        setUser(next);
        return next;
      }
    } catch (e) {
      console.warn("[Auth] refreshUser", e.code, e.message);
    }
    return null;
  }, [fetchUserFromServer]);

 useEffect(() => {
  const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
    if (unsubSnapRef.current) {
      unsubSnapRef.current();
      unsubSnapRef.current = null;
    }

    firebaseUserRef.current = firebaseUser;

    if (!firebaseUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Critical: attach a fresh token BEFORE any Firestore reads
      await firebaseUser.getIdToken(true);
      await ensureUserDocument(firebaseUser);

      const userRef = doc(db, "users", firebaseUser.uid);
      const next = await fetchUserFromServer(firebaseUser);
      setUser(next || buildUser(firebaseUser));
      setLoading(false);

      unsubSnapRef.current = onSnapshot(
        userRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            ensureUserDocument(firebaseUser).catch(() => {});
            return;
          }
          setUser(buildUser(firebaseUser, snapshot.data()));
        },
        (error) => {
          console.error("[Auth] snapshot", error.code, error.message);
          if (error.code === "permission-denied") {
            showAppError("Profile access", error);
          }
        }
      );
    } catch (error) {
      console.error("[Auth] init", error.code, error.message);
      showAppError("Sign-in profile", error);
      setUser(buildUser(firebaseUser));
      setLoading(false);
    }
  });

  return () => {
    unsubAuth();
    if (unsubSnapRef.current) unsubSnapRef.current();
  };
}, [fetchUserFromServer]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle;
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) refreshUser();
    }).then((h) => {
      handle = h;
    });
    return () => handle?.remove?.();
  }, [refreshUser]);

  const signOutUser = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      showAppError("Sign Out", error);
    }
  };







  return (
    <AuthContext.Provider value={{ user, loading, signOutUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};