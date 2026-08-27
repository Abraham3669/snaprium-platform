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
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
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

      setUser(buildUser(firebaseUser));
      setLoading(false);

      const userRef = doc(db, "users", firebaseUser.uid);

      (async () => {
        try {
          const snap = await ensureUserDocument(firebaseUser);
          if (snap?.exists()) {
            setUser(buildUser(firebaseUser, snap.data()));
          }
        } catch (error) {
          console.error("[Auth] ensureUserDocument", error.code, error.message);
          showAppError("Create profile", error);
        }

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
          }
        );
      })();
    });

    return () => {
      unsubAuth();
      if (unsubSnapRef.current) unsubSnapRef.current();
    };
  }, []);

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