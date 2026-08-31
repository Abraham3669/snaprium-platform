import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { Capacitor } from "@capacitor/core";
import { showAppError } from "../utils/errorReporter";
import { useAuth } from "../context/AuthContext";
import { ensureUserDocument } from "../lib/userProfile";

const WEB_CLIENT_ID =
  "16016330247-0pehuf4ugm4ibp229hkc94lpj0t27bf3.apps.googleusercontent.com";

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        const { GoogleSignIn } = await import(
          "@capawesome/capacitor-google-sign-in"
        );
        await GoogleSignIn.initialize({ clientId: WEB_CLIENT_ID });
        const nativeResult = await GoogleSignIn.signIn();
        const idToken = nativeResult?.idToken;
        if (!idToken) throw new Error("No Google idToken from native sign-in");
        const credential = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(auth, credential);
        firebaseUser = result.user;
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        firebaseUser = result.user;
      }

      await ensureUserDocument(firebaseUser);
    } catch (err) {
      console.error("Google sign-in", err.code, err.message, err);
      showAppError("Google Sign-In", err);
      setError(err.message || "Google sign-in failed");
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
      <h1>Welcome Back</h1>
      <p>Sign in to continue to Snaprium</p>

      <button onClick={handleGoogleSignIn} disabled={loading} className="btn-google">
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

      {error && <p className="error-message">{error}</p>}

      <p className="auth-link">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}