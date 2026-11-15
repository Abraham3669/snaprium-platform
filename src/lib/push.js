// src/lib/push.js
//
// iPhone push notifications (Apple's push service, no Firebase iOS SDK).
//
//  - syncPush(uid, navigate)  call when the signed-in person changes.
//        If they already allowed notifications it quietly registers this phone.
//        It also wires "tap a notification -> open the right screen".
//  - enablePush()             asks for permission (call from a button, never at launch).
//  - getPushState()           "unsupported" | "prompt" | "denied" | "granted"
//  - clearDeliveredPush()     removes banners from the lock screen and resets the badge.
//
// Device tokens are saved in  pushTokens/{token} = { uid, platform, updatedAt }.
// Signing out deletes this phone's token first, so the next person who signs in
// on the same phone never receives the previous person's alerts.

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const TOKEN_KEY = "snaprium_push_token";

const supported =
  Capacitor.isNativePlatform() &&
  Capacitor.getPlatform() === "ios" &&
  Capacitor.isPluginAvailable("PushNotifications");

let registeredThisRun = false;
let currentUid = null;
let navigateTo = null;
let listenersReady = false;
let signOutHookReady = false;

async function saveToken(token) {
  if (!token) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
  if (!currentUid) return;
  try {
    await setDoc(doc(db, "pushTokens", token), {
      uid: currentUid,
      platform: "ios",
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[push] could not save token", err?.message || err);
  }
}

// A one-line report of how push setup went on this phone. Open Firestore > pushDiag > your user id to read it
// (there is no Mac console here, so this is how a registration problem becomes visible).
async function logDiag(fields) {
  if (!currentUid) return;
  try {
    await setDoc(
      doc(db, "pushDiag", currentUid),
      { platform: "ios", at: serverTimestamp(), ...fields },
      { merge: true }
    );
  } catch {}
}

// Ask iOS for this phone's token, and report it if iOS never answers (usually a signing/entitlement problem).
function registerWithWatch() {
  registeredThisRun = false;
  PushNotifications.register().catch((e) =>
    logDiag({ ok: false, error: `register() failed: ${String(e?.message || e).slice(0, 200)}` })
  );
  setTimeout(() => {
    if (!registeredThisRun) {
      logDiag({
        ok: false,
        error: "iOS gave no answer after 20 seconds. The app was probably built without the push entitlement, or AppDelegate is not passing the token on.",
      });
    }
  }, 20000);
}

async function dropToken() {
  let token = "";
  try {
    token = localStorage.getItem(TOKEN_KEY) || "";
  } catch {}
  if (!token) return;
  try {
    await deleteDoc(doc(db, "pushTokens", token));
  } catch {}
}

function ensureListeners() {
  if (listenersReady || !supported) return;
  listenersReady = true;
  try {
    PushNotifications.addListener("registration", (t) => {
      registeredThisRun = true;
      saveToken(t?.value);
      logDiag({ ok: true, error: "", tokenTail: String(t?.value || "").slice(-8), permission: "granted" });
    });
    PushNotifications.addListener("registrationError", (e) => {
      registeredThisRun = true;
      console.warn("[push] registration failed", e?.error || e);
      logDiag({ ok: false, error: String(e?.error || e?.message || e).slice(0, 300) });
    });
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const url = action?.notification?.data?.url;
      if (typeof url === "string" && url.startsWith("/") && navigateTo) navigateTo(url);
    });
  } catch (err) {
    console.warn("[push] listeners", err?.message || err);
  }
}

// Runs just BEFORE Firebase signs the person out, while they are still signed in.
function ensureSignOutHook() {
  if (signOutHookReady || !supported) return;
  signOutHookReady = true;
  try {
    auth.beforeAuthStateChanged(async (next) => {
      if (next) return;
      try {
        await Promise.race([dropToken(), new Promise((r) => setTimeout(r, 2500))]);
      } catch {}
    });
  } catch {}
}

export async function getPushState() {
  if (!supported) return "unsupported";
  try {
    const res = await PushNotifications.checkPermissions();
    if (res.receive === "granted") return "granted";
    if (res.receive === "denied") return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
}

export async function enablePush() {
  if (!supported) return "unsupported";
  ensureListeners();
  try {
    const res = await PushNotifications.requestPermissions();
    if (res.receive === "granted") {
      registerWithWatch();
      return "granted";
    }
    logDiag({ ok: false, permission: String(res.receive || "prompt"), error: "Permission not granted" });
    return res.receive === "denied" ? "denied" : "prompt";
  } catch (err) {
    console.warn("[push] enable", err?.message || err);
    return "unsupported";
  }
}

export function syncPush(uid, navigate) {
  currentUid = uid || null;
  navigateTo = navigate || null;
  if (!supported) return;
  ensureListeners();
  ensureSignOutHook();
  if (!uid) return;
  getPushState().then((state) => {
    // Already allowed: register again so Apple's token stays fresh.
    if (state === "granted" && currentUid === uid) {
      registerWithWatch();
    }
  });
}

export function clearDeliveredPush() {
  if (!supported) return;
  try {
    PushNotifications.removeAllDeliveredNotifications().catch(() => {});
  } catch {}
}