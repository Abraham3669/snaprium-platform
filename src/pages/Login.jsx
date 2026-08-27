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
        const { FirebaseAuthentication } = await import(
          "@capacitor-firebase/authentication"
        );
        const nativeResult = await FirebaseAuthentication.signInWithGoogle();
        const idToken = nativeResult?.credential?.idToken;
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
        {loading ? "Connecting..." : "Continue with Google"}
      </button>

      {error && <p className="error-message">{error}</p>}

      <p className="auth-link">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}