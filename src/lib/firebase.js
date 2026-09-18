import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  GoogleAuthProvider,
} from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { getAnalytics, logEvent as fbLogEvent, setUserId as fbSetUserId } from "firebase/analytics";
import { Capacitor } from "@capacitor/core";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("[Firebase] Missing VITE_FIREBASE_* env vars");
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;
if (Capacitor.isNativePlatform()) {
  try {
    auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence,
    });
  } catch {
    auth = getAuth(app);
  }
} else {
  auth = getAuth(app);
}

export { auth };

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
googleProvider.addScope("email");
googleProvider.addScope("profile");

let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}

export { db };

let analytics = null;
try {
  if (typeof window !== "undefined" && firebaseConfig.measurementId) {
    analytics = getAnalytics(app);
  }
} catch (err) {
  console.warn("[Firebase] analytics unavailable", err?.message);
}

export { analytics };

export function logEvent(analyticsInstance, name, params = {}) {
  const instance = analyticsInstance || analytics;
  if (!instance || !name) return;
  try {
    fbLogEvent(instance, name, {
      ...params,
      platform: Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web",
    });
  } catch (err) {
    console.warn("[analytics]", name, err?.message);
  }
}

export function setUserId(analyticsInstance, uid) {
  const instance = analyticsInstance || analytics;
  if (!instance || !uid) return;
  try {
    fbSetUserId(instance, uid);
  } catch {}
}

export function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: windows-app)").matches ||
    window.navigator.standalone === true
  );
}

export default app;