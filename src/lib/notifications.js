// src/lib/notifications.js
//
// In-app notifications. One document per event, stored under the person who
// should see it:  users/{toUid}/notifications/{id}
//
//  - The sender CREATES the document (rules check they belong to the circle).
//  - The id is built from the event, so the same person doing the same thing
//    twice (e.g. Spark, un-Spark, Spark again) can never notify twice.
//  - Only the owner can read, mark read, or delete.
//  - After the document exists we ask the push handler (reached through /api/daily-room) to deliver the iPhone alert.
//    If that call fails the in-app notification still exists.

import {
  collection,
  doc,
  setDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const SENT_KEY = "snaprium_sent_notifs";
const SENT_MAX = 400;

function readSent() {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function rememberSent(id) {
  try {
    const list = readSent().filter((x) => x !== id);
    list.push(id);
    localStorage.setItem(SENT_KEY, JSON.stringify(list.slice(-SENT_MAX)));
  } catch {}
}

const clean = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function apiBase() {
  return (import.meta.env.VITE_API_URL || "https://snaprium.com").replace(/\/$/, "");
}

// Fire-and-forget call to the push endpoint. Never throws.
async function callPushApi(body) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch(`${apiBase()}/api/daily-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch (err) {
    console.debug("[push] not sent", err?.message || err);
  }
}

/**
 * Notify one person.
 *   to        uid of the person to notify
 *   type      "mention" | "reply" | "answer" | "spark" | "reaction"
 *   from      { uid, displayName, photoURL }
 *   community { id, name }
 *   key       id of the thing this is about (message id, reply id...)
 *   url       where tapping it should go, e.g. /community/ID/chat?board=B&q=Q
 */
export async function notifyUser({
  to,
  type,
  from,
  community,
  boardId = "",
  targetId = "",
  preview = "",
  emoji = "",
  key,
  url,
}) {
  if (!to || !from?.uid || !community?.id || !key || !url) return;
  if (to === from.uid || to === "snaprium-ai") return;

  const id = `${type}_${String(key).replace(/[^\w-]/g, "")}_${from.uid}`;
  if (readSent().includes(id)) return;
  rememberSent(id);

  try {
    await setDoc(doc(db, "users", to, "notifications", id), {
      type,
      fromUid: from.uid,
      fromName: clean(from.displayName || "Someone", 60),
      fromPhoto: from.photoURL && from.photoURL.length < 400 ? from.photoURL : "",
      communityId: community.id,
      communityName: clean(community.name || "Circle", 60),
      boardId: boardId || "",
      targetId: targetId || "",
      preview: clean(preview, 140),
      emoji: emoji || "",
      url,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Already sent before, or the person left the circle. Nothing to do.
    return;
  }
  callPushApi({ action: "push:notify", to, id });
}

/** Tell the circle a live session just started (server fans it out). */
export function notifyCircleSession(communityId, boardId = "") {
  if (!communityId) return;
  callPushApi({ action: "push:session", communityId, boardId });
}

export function subscribeToNotifications(uid, cb) {
  if (!uid) return () => {};
  const q = query(
    collection(db, "users", uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(60)
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.warn("[notifications]", err?.message || err);
      cb([]);
    }
  );
}

export async function markNotificationRead(uid, id) {
  if (!uid || !id) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid, "notifications", id), { read: true });
  await batch.commit();
}

export async function markAllNotificationsRead(uid, items) {
  const unread = (items || []).filter((n) => !n.read);
  if (!uid || !unread.length) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, "users", uid, "notifications", n.id), { read: true }));
  await batch.commit();
}

/** One line of text for a notification row. */
export function describeNotification(n) {
  const who = n.fromName || "Someone";
  switch (n.type) {
    case "mention":
      return `${who} mentioned you`;
    case "reply":
      return `${who} replied to you`;
    case "answer":
      return `${who} answered your question`;
    case "spark":
      return n.emoji === "question" ? `${who} sparked your question` : `${who} sparked your answer`;
    case "reaction":
      return `${who} reacted ${n.emoji || ""} to your message`.replace("  ", " ");
    case "session":
      return `${who} started a live session`;
    default:
      return `${who} sent you an update`;
  }
}

export function notificationTime(createdAt) {
  const d = createdAt?.toDate?.() || (createdAt ? new Date(createdAt) : null);
  if (!d || Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}