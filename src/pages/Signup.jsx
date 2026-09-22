import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
} from "firebase/auth";
import { auth, googleProvider, isStandaloneApp } from "../lib/firebase";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { useAuth } from "../context/AuthContext";
import { ensureUserDocument } from "../lib/userProfile";

const appleProvider = new OAuthProvider("apple.com");

export default function Signup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) await ensureUserDocument(result.user);
      })
      .catch((err) => {
        console.error("Redirect sign-up", err.code, err.message);
        setError(err.message || "Failed to sign up.");
      });
  }, []);

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleGoogleSignUp = async () => {
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
      } else {
        try {
          const result = await signInWithPopup(auth, googleProvider);
          firebaseUser = result.user;
        } catch (popupErr) {
          if (
            popupErr?.code === "auth/popup-blocked" ||
            popupErr?.code === "auth/popup-closed-by-user" ||
            popupErr?.code === "auth/operation-not-supported-in-this-environment" ||
            /getContext|popup/i.test(popupErr?.message || "")
          ) {
            await signInWithRedirect(auth, googleProvider);
            return;
          }
          throw popupErr;
        }
      }

      await ensureUserDocument(firebaseUser);
    } catch (err) {
      console.error("Google sign-up", err.code, err.message);
      setError(err.message || "Failed to sign up with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
    setLoading(true);
    setError("");
    try {
      let firebaseUser;

      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithApple();
        const idToken = result.credential?.idToken;
        const rawNonce = result.credential?.nonce;
        if (!idToken) throw new Error("No Apple idToken from native sign-in");
        const credential = appleProvider.credential({
          idToken,
          rawNonce,
        });
        const userCredential = await signInWithCredential(auth, credential);
        firebaseUser = userCredential.user;
      } else {
        try {
          const result = await signInWithPopup(auth, appleProvider);
          firebaseUser = result.user;
        } catch (popupErr) {
          if (
            popupErr?.code === "auth/popup-blocked" ||
            popupErr?.code === "auth/popup-closed-by-user" ||
            popupErr?.code === "auth/operation-not-supported-in-this-environment" ||
            /getContext|popup/i.test(popupErr?.message || "")
          ) {
            await signInWithRedirect(auth, appleProvider);
            return;
          }
          throw popupErr;
        }
      }

      await ensureUserDocument(firebaseUser);
    } catch (err) {
      console.error("Apple sign-up", err.code, err.message);
      setError(err.message || "Failed to sign up with Apple.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="auth-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <h1>Create Account</h1>
      <p>Join Snaprium</p>

      <button
        onClick={handleGoogleSignUp}
        disabled={loading}
        className="btn-google"
        style={{ width: "100%", marginBottom: "12px" }}
      >
        {loading ? "Connecting to Google..." : (
          <>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.239 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4c-7.682 0-14.318 4.337-17.694 10.691z" />
              <path fill="#4CAF50" d="M24 44c5.177 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.143 35.091 26.715 36 24 36c-5.218 0-9.621-3.317-11.283-7.946l-6.522 5.025C9.532 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.793 2.239-2.231 4.166-4.084 5.57l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            <span>Sign up with Google</span>
          </>
        )}
      </button>

      {/*
        Apple requires this whenever a third-party social login is offered
        (guideline 4.8). Skip it on Android — not required there.
      */}
      {(Capacitor.getPlatform() !== "android") && (
        <button
          onClick={handleAppleSignUp}
          disabled={loading}
          className="btn-apple"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            marginBottom: "24px",
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
              <span>Sign up with Apple</span>
            </>
          )}
        </button>
      )}

      {error && <p className="error-message">{error}</p>}

      <p className="auth-link">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}