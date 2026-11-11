// src/lib/track.js
// Small, safe product analytics. Every call is fire-and-forget and never throws,
// so a tracking problem can never break the app.
import { Capacitor } from "@capacitor/core";
import { addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { auth, db, analytics, logEvent } from "./firebase";

const OPEN_GAP_MS = 30 * 60 * 1000; // one "app open" per 30 minutes
const lastSent = new Map(); // in-memory throttle

const todayUTC = () => new Date().toISOString().slice(0, 10);

function throttled(key, ms) {
  const now = Date.now();
  if (now - (lastSent.get(key) || 0) < ms) return true;
  lastSent.set(key, now);
  return false;
}

// type: "app_open" | "circle_join" | "circle_create" | "chat_message"
//       | "question_post" | "reply_post" | "call_join"
export async function track(type, extra = {}, { throttleMs = 0 } = {}) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (throttleMs && throttled(`${type}:${extra.circleId || ""}`, throttleMs)) return;

    const data = {
      type,
      uid,
      day: todayUTC(),
      platform: Capacitor.getPlatform(),
      ts: serverTimestamp(),
    };
    if (extra.circleId) data.circleId = String(extra.circleId);

    await addDoc(collection(db, "events"), data);
    try {
      logEvent(analytics, type, { platform: data.platform });
    } catch {
      /* analytics not available on this platform */
    }
  } catch (err) {
    console.warn("[track]", type, err?.code || err?.message);
  }
}

// Called when a signed-in person opens the app or comes back to it.
// Saves "last active" on their profile and, once, their real sign-up date.
export function trackAppOpen(firebaseUser, userData = {}) {
  const uid = firebaseUser?.uid;
  if (!uid) return;

  const key = `snaprium_last_open_${uid}`;
  let last = lastSent.get(key) || 0;
  try {
    last = Math.max(last, Number(localStorage.getItem(key)) || 0);
  } catch {
    /* storage blocked */
  }
  if (Date.now() - last < OPEN_GAP_MS) return;

  lastSent.set(key, Date.now());
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* storage blocked */
  }

  const patch = { lastActiveAt: serverTimestamp() };
  const created = firebaseUser.metadata?.creationTime;
  if (!userData.createdAt && !userData.signupAt && created) {
    const when = new Date(created);
    if (!Number.isNaN(when.getTime())) patch.signupAt = Timestamp.fromDate(when);
  }

  updateDoc(doc(db, "users", uid), patch).catch(() => {});
  track("app_open");
}