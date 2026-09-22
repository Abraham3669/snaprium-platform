// src/lib/notifications.js
// Turn this on after Firebase Cloud Messaging + certificates are ready.
export const ENABLE_PUSH = false;

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function registerPushToken(uid) {
  if (!ENABLE_PUSH || !uid) return null;
  if (typeof window === "undefined" || !("Notification" in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  // When you enable FCM, save the token here.
  // const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY });
  const token = null;

  if (!token) return null;

  await setDoc(
    doc(db, "users", uid),
    {
      fcmToken: token,
      fcmUpdatedAt: serverTimestamp(),
      notificationsEnabled: true,
    },
    { merge: true }
  );

  return token;
}

export function showLocalNotice(title, body) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {}
}