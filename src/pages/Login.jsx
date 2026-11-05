import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, googleProvider, isStandaloneApp } from "../lib/firebase";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { useAuth } from "../context/AuthContext";
import { ensureUserDocument } from "../lib/userProfile";

function isPackagedOrStandaloneWeb() {
  if (typeof window === "undefined") return false;
  if (Capacitor.isNativePlatform()) return false;

  const ref = document.referrer || "";
  const ua = navigator.userAgent || "";

  const standalone =
    isStandaloneApp() ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: windows-app)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true;

  const msStore = /app-info:\/\/platform\/microsoft-store/i.test(ref);
  const windows = /Windows|Win64|Win32/i.test(ua);

  return standalone || msStore || (windows && standalone);
}

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingRedirect, setCheckingRedirect] = useState(true);

  // 1. Handle return from signInWithRedirect + extra safety for Edge WebView2 / MSIX
  useEffect(() => {
    let cancelled = false;
    let unsub = null;

    async function handleRedirect() {
      try {
        if (auth.authStateReady) {
          await auth.authStateReady();
        }

        // Must run once on every load after Google redirect
        const result = await getRedirectResult(auth);
        const firebaseUser = result?.user || auth.currentUser;

        if (firebaseUser) {
          await ensureUserDocument(firebaseUser);
          // Force token so AuthContext / Firestore see a real session
          await firebaseUser.getIdToken(true);
          if (!cancelled) {
            navigate("/", { replace: true });
          }
          return;
        }
      } catch (err) {
        console.error("Redirect sign-in error", err?.code, err?.message);
        if (!cancelled) {
          setError(err?.message || "Sign-in failed after Google redirect");
        }
      } finally {
        if (!cancelled) {
          setCheckingRedirect(false);
        }
      }
    }

    handleRedirect();

    // Extra safety net – catches cases where session is restored via onAuthStateChanged
    unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !cancelled) {
        try {
          await ensureUserDocument(firebaseUser);
          navigate("/", { replace: true });
        } catch (e) {
          console.error("ensureUserDocument failed", e);
        }
      }
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [navigate]);

  // 2. Normal navigation once AuthContext has the user
  useEffect(() => {
    if (user && !authLoading && !loading && !checkingRedirect) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading, loading, checkingRedirect, navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    let usedRedirect = false;

    try {
      // Capacitor native (iOS / Android)
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result.credential?.idToken;
        if (!idToken) throw new Error("No Google idToken from native sign-in");
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        await ensureUserDocument(userCredential.user);
        await userCredential.user.getIdToken(true);
        navigate("/", { replace: true });
        return;
      }

      // Installed PWA / Edge app / Microsoft Store package → never use popup
      // Popup can complete Google and still leave this window unsigned-in
      if (isPackagedOrStandaloneWeb()) {
        usedRedirect = true;
        await signInWithRedirect(auth, googleProvider);
        return; // full navigation away
      }

      // Normal browser tab only
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (!result?.user) {
          throw new Error("Google popup closed without a user session");
        }
        await ensureUserDocument(result.user);
        await result.user.getIdToken(true);
        navigate("/", { replace: true });
        return;
      } catch (popupErr) {
        console.warn("Popup failed, using redirect", popupErr?.code, popupErr?.message);

        const shouldFallback =
          popupErr?.code === "auth/popup-blocked" ||
          popupErr?.code === "auth/popup-closed-by-user" ||
          popupErr?.code === "auth/operation-not-supported-in-this-environment" ||
          popupErr?.code === "auth/cancelled-popup-request" ||
          /getContext|popup|blocked|closed|opener|COOP|storage|timeout/i.test(
            popupErr?.message || ""
          );

        if (shouldFallback) {
          usedRedirect = true;
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw popupErr;
      }
    } catch (err) {
      console.error("Google sign-in", err?.code, err?.message);
      setError(err?.message || "Google sign-in failed");
    } finally {
      // If we redirected, the page is unloading — still safe
      if (!usedRedirect) {
        setLoading(false);
      }
    }
  };

  // Show loading while we check for a pending redirect result
  if (authLoading || checkingRedirect) {
    return (
      <div className="auth-container">
        <p>Signing you in...</p>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <button
        type="button"
        className="auth-home-link"
        onClick={() => navigate("/")}
      >
        ← Home
      </button>
      <h1>Welcome Back</h1>
      <p>Sign in to continue to Snaprium</p>

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="btn-google"
      >
        {loading ? (
          "Connecting..."
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#FFC107"
                d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.239 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
              />
              <path
                fill="#FF3D00"
                d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4c-7.682 0-14.318 4.337-17.694 10.691z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.177 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.143 35.091 26.715 36 24 36c-5.218 0-9.621-3.317-11.283-7.946l-6.522 5.025C9.532 39.556 16.227 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.611 20.083H42V20H24v8h11.303c-.793 2.239-2.231 4.166-4.084 5.57l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
              />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {/* Apple login still commented out for Store certification */}

      {error && <p className="error-message">{error}</p>}

      <p className="auth-link">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}