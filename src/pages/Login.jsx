import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  GoogleAuthProvider,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  // OAuthProvider, // only needed for Apple sign-in — re-enable when Apple is turned back on
} from "firebase/auth";
import { auth, googleProvider, isStandaloneApp } from "../lib/firebase";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { useAuth } from "../context/AuthContext";
import { ensureUserDocument } from "../lib/userProfile";

// Web fallback provider for Apple (native path uses FirebaseAuthentication.signInWithApple)
// const appleProvider = new OAuthProvider("apple.com"); // Apple sign-in disabled for now

// Helper: race a promise against a timeout so a silently-hanging popup
// (e.g. WebView2 in a signed/installed MSIX app failing to open a real
// popup window) doesn't leave the user stuck on "Connecting..." forever.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("popup-timeout")), ms)
    ),
  ]);
}

// Force durable persistence before any redirect-based sign-in. If
// indexedDB isn't available/writable in this WebView2 context, fall
// back to localStorage rather than letting Firebase silently default
// to in-memory persistence, which would lose the pending-redirect
// state across the navigation to Google and back.
async function ensurePersistence() {
  try {
    await setPersistence(auth, indexedDBLocalPersistence);
  } catch (e) {
    console.warn("indexedDB persistence failed, falling back", e);
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (e2) {
      console.error("browserLocal persistence also failed", e2);
    }
  }
}

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Diagnostics: log immediately on mount so you can see in WebView2
    // devtools whether this file even re-runs after the redirect, and
    // whether auth.currentUser is already populated by the time we ask.
    console.log("[auth] mount — auth.currentUser:", auth.currentUser);

    getRedirectResult(auth)
      .then(async (result) => {
        console.log("[auth] getRedirectResult ->", result);
        if (result?.user) {
          await ensureUserDocument(result.user);
        } else if (auth.currentUser) {
          // Some environments populate auth.currentUser via
          // onAuthStateChanged slightly before/without a redirect
          // result object being returned. Treat that as success too.
          console.log("[auth] no redirect result, but currentUser present");
          await ensureUserDocument(auth.currentUser);
        } else {
          console.warn("[auth] redirect returned no user and no currentUser — persistence likely didn't survive the navigation");
        }
      })
      .catch((err) => {
        console.error("Redirect sign-in", err.code, err.message);
        setError(err.message || "Sign-in failed");
      });
  }, []);

  useEffect(() => {
    if (user && !authLoading && !loading) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading, loading, navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      let firebaseUser;

      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result.credential?.idToken;
        if (!idToken) throw new Error("No Google idToken from native sign-in");
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        firebaseUser = userCredential.user;
      } else if (isStandaloneApp) {
        // Installed PWA / MSIX-packaged WebView2 — popups can silently
        // hang here (Store-signed installs hit a documented WebView2
        // NewWindowRequested bug that never opens a real popup and
        // never throws), so go straight to redirect instead of waiting
        // on a popup error that may never come.
        await ensurePersistence();
        await signInWithRedirect(auth, googleProvider);
        return;
      } else {
        try {
          const result = await withTimeout(
            signInWithPopup(auth, googleProvider),
            8000
          );
          firebaseUser = result.user;
        } catch (popupErr) {
          if (
            popupErr?.code === "auth/popup-blocked" ||
            popupErr?.code === "auth/popup-closed-by-user" ||
            popupErr?.code === "auth/operation-not-supported-in-this-environment" ||
            popupErr?.message === "popup-timeout" ||
            /getContext|popup/i.test(popupErr?.message || "")
          ) {
            await ensurePersistence();
            await signInWithRedirect(auth, googleProvider);
            return;
          }
          throw popupErr;
        }
      }

      await ensureUserDocument(firebaseUser);
    } catch (err) {
      console.error("Google sign-in", err.code, err.message);
      setError(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  // Apple sign-in temporarily disabled. Not deleted — uncomment this
  // function, the appleProvider above, the OAuthProvider import, and the
  // button block below when Apple is ready to go back live.
  //
  // const handleAppleSignIn = async () => {
  //   setLoading(true);
  //   setError("");
  //   try {
  //     let firebaseUser;
  //
  //     if (Capacitor.isNativePlatform()) {
  //       // Native iOS: uses the real Sign in with Apple sheet via the
  //       // capacitor-firebase plugin, requires the entitlement set up in Xcode.
  //       const result = await FirebaseAuthentication.signInWithApple();
  //       const idToken = result.credential?.idToken;
  //       const rawNonce = result.credential?.nonce;
  //       if (!idToken) throw new Error("No Apple idToken from native sign-in");
  //       const credential = appleProvider.credential({
  //         idToken,
  //         rawNonce,
  //       });
  //       const userCredential = await signInWithCredential(auth, credential);
  //       firebaseUser = userCredential.user;
  //     } else {
  //       try {
  //         const result = await withTimeout(
  //           signInWithPopup(auth, appleProvider),
  //           8000
  //         );
  //         firebaseUser = result.user;
  //       } catch (popupErr) {
  //         if (
  //           popupErr?.code === "auth/popup-blocked" ||
  //           popupErr?.code === "auth/popup-closed-by-user" ||
  //           popupErr?.code === "auth/operation-not-supported-in-this-environment" ||
  //           popupErr?.message === "popup-timeout" ||
  //           /getContext|popup/i.test(popupErr?.message || "")
  //         ) {
  //           await signInWithRedirect(auth, appleProvider);
  //           return;
  //         }
  //         throw popupErr;
  //       }
  //     }
  //
  //     await ensureUserDocument(firebaseUser);
  //   } catch (err) {
  //     console.error("Apple sign-in", err.code, err.message);
  //     setError(err.message || "Apple sign-in failed");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  if (authLoading) {
    return (
      <div className="auth-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <h1>Welcome Back</h1>
      <p>Sign in to continue to Snaprium</p>

      <button onClick={handleGoogleSignIn} disabled={loading} className="btn-google">
        {loading ? "Connecting..." : (
          <>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.239 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4c-7.682 0-14.318 4.337-17.694 10.691z" />
              <path fill="#4CAF50" d="M24 44c5.177 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.143 35.091 26.715 36 24 36c-5.218 0-9.621-3.317-11.283-7.946l-6.522 5.025C9.532 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.793 2.239-2.231 4.166-4.084 5.57l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {/*
        Apple sign-in temporarily disabled — commented out below, not
        removed. Uncomment when Apple auth is ready to go back live.
        Reminder: Apple requires this button to be shown whenever a
        third-party social login (Google) is offered as a sign-in option
        (guideline 4.8), except on Android.
      */}
      {/*
      {(Capacitor.getPlatform() !== "android") && (
        <button
          onClick={handleAppleSignIn}
          disabled={loading}
          className="btn-apple"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            marginTop: "12px",
            background: "#000",
            color: "#fff",
            borderRadius: 8,
            padding: "12px 16px",
            border: "none",
          }}
        >
          {loading ? "Connecting..." : (
            <>
              <svg width="18" height="18" viewBox="0 0 384 512" fill="#fff" aria-hidden="true">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
              <span>Continue with Apple</span>
            </>
          )}
        </button>
      )}
      */}

      {error && <p className="error-message">{error}</p>}

      <p className="auth-link">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}