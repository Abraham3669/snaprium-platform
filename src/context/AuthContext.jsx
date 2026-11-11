import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocFromServer, onSnapshot } from "firebase/firestore";
import { showAppError } from "../utils/errorReporter";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { ensureUserDocument } from "../lib/userProfile";
import { trackAppOpen } from "../lib/track";

const AuthContext = createContext();

// Owner accounts are never locked out by the ban screen
const OWNER_UIDS = ["Lk4u7TOvblTYl1NAxtOAeYBHRHu1"];

// Shown instead of the whole app when an admin has banned this account
function BannedScreen({ onSignOut }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg, #fff)",
        color: "var(--text-primary, #111827)",
      }}
    >
      <div
        role="alert"
        style={{
          width: "100%",
          maxWidth: 420,
          textAlign: "center",
          padding: 28,
          borderRadius: 20,
          border: "1px solid var(--border, #e5e7eb)",
          background: "var(--surface, #fff)",
          boxShadow: "var(--shadow-md, 0 10px 30px rgba(0,0,0,0.08))",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: "1.4rem" }}>Account suspended</h1>
        <p style={{ margin: "0 0 20px", color: "var(--text-secondary, #6b7280)", lineHeight: 1.5 }}>
          This account can't use Snaprium right now. If you think this is a mistake, please
          contact the Snaprium team at{" "}
          <a
            href="mailto:support@snaprium.com"
            style={{ color: "var(--accent, #4f46e5)", fontWeight: 600 }}
          >
            support@snaprium.com
          </a>
          .
        </p>
        <button
          type="button"
          onClick={onSignOut}
          style={{
            minHeight: 44,
            padding: "0 22px",
            borderRadius: 12,
            border: "1px solid var(--border, #e5e7eb)",
            background: "var(--surface, #fff)",
            color: "var(--text-primary, #111827)",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function buildUser(firebaseUser, data = {}) {
  const plan = data.plan || "free";
  const banned = data.banned === true;
  const hasDoc = Object.keys(data).length > 0;

  const displayName = hasDoc
    ? (data.displayName || firebaseUser.email?.split("@")[0] || "User")
    : (firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User");

  // Once a Firestore profile exists, never fall back to Google photo
  const photoURL = hasDoc
    ? (data.photoURL || "")
    : (firebaseUser.photoURL || "");

  return {
    uid: firebaseUser.uid,
    email: data.email || firebaseUser.email || "",
    displayName,
    photoURL,
    ...data,
    plan,
    banned,
    isBanned: banned,
    displayName,
    photoURL,
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

  // analytics: note when a signed-in person opens the app (at most once every 30 minutes)
  useEffect(() => {
    if (!user?.uid || user.banned) return undefined;
    const open = () => trackAppOpen(firebaseUserRef.current || auth.currentUser, user);
    open();
    const onVisible = () => {
      if (document.visibilityState === "visible") open();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.banned]);

  const signOutUser = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      showAppError("Sign Out", error);
    }
  };







  const blocked = Boolean(user?.banned) && !OWNER_UIDS.includes(user.uid);

  return (
    <AuthContext.Provider value={{ user, loading, signOutUser, refreshUser }}>
      {blocked ? <BannedScreen onSignOut={signOutUser} /> : children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};