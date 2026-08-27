import { signInWithPopup, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { ensureUserDocument } from "../lib/userProfile";

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