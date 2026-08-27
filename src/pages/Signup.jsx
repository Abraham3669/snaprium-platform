import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../context/AuthContext";
import { ensureUserDocument } from "../lib/userProfile";

export default function Signup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      console.error("Google sign-up", err.code, err.message);
      setError(err.message || "Failed to sign up with Google.");
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
        style={{ width: "100%", marginBottom: "24px" }}
      >
        {loading ? "Connecting to Google..." : "Sign up with Google"}
      </button>

      {error && <p className="error-message">{error}</p>}

      <p className="auth-link">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}