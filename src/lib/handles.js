// src/lib/handles.js
//
// Usernames ("handles"), like @sam on X. One per person, unique, never an email.
//
//  - handles/{handle}  = { uid, handle, nameLower, createdAt }   anyone can read it, only the owner can write it.
//    The document id IS the handle (lowercase), so two people can never hold the same one: the database refuses the second.
//  - publicProfiles/{uid}.handle  = the same handle, so posts can show it next to a name.
//
// Rules of a handle: 3 to 20 characters, a to z, 0 to 9 and underscore, lowercase, not only digits, not a reserved word.
// The first one is free. After that it can be changed once every 30 days (the old one is released).

import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { publicName } from "./publicName";
import { rememberHandle } from "./publicProfile";

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const HANDLE_COOLDOWN_DAYS = 30;
const HANDLE_RE = /^[a-z0-9_]+$/;

// Words nobody should be able to take, so nobody can pretend to be the company or a page of the app.
const RESERVED = new Set([
  "admin", "administrator", "root", "support", "help", "staff", "team", "official", "moderator", "mod",
  "snaprium", "snap", "system", "security", "privacy", "terms", "billing", "contact", "info", "news",
  "api", "app", "www", "mail", "null", "undefined", "anonymous", "everyone", "you", "me", "self",
  "home", "login", "signup", "profile", "settings", "search", "circles", "community", "post", "posts",
  "feed", "explore", "messages", "notifications", "study", "solver", "upgrade", "checkout", "refunds",
]);

export const cleanHandle = (s) => String(s || "").trim().replace(/^@+/, "").toLowerCase();

/** "" when the handle is fine, otherwise the reason in plain words. */
export function checkHandle(input) {
  const h = cleanHandle(input);
  if (!h) return "Choose a username";
  if (h.length < HANDLE_MIN) return `Use at least ${HANDLE_MIN} characters`;
  if (h.length > HANDLE_MAX) return `Use at most ${HANDLE_MAX} characters`;
  if (!HANDLE_RE.test(h)) return "Use only letters, numbers and underscores";
  if (/^[0-9]+$/.test(h)) return "Add at least one letter";
  if (RESERVED.has(h)) return "That username is not available";
  return "";
}

/** A starting idea from someone's name, already valid when possible. "" when nothing useful comes out. */
export function suggestHandle(name) {
  let h = String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, HANDLE_MAX);
  if (h === "member") return "";
  if (h.length < HANDLE_MIN) return "";
  return checkHandle(h) ? "" : h;
}

/** true = free, false = taken, null = could not tell. Yours counts as free. */
export async function isHandleFree(input, myUid = "") {
  const h = cleanHandle(input);
  if (checkHandle(h)) return false;
  try {
    const snap = await getDoc(doc(db, "handles", h));
    if (!snap.exists()) return true;
    return !!myUid && snap.data().uid === myUid;
  } catch {
    return null;
  }
}

/** Handle -> uid ("" when nobody has it). */
export async function resolveHandle(input) {
  const h = cleanHandle(input);
  if (checkHandle(h)) return "";
  try {
    const snap = await getDoc(doc(db, "handles", h));
    return snap.exists() ? snap.data().uid || "" : "";
  } catch {
    return "";
  }
}

/** Looks like a username and not a 28 character account id. */
export const looksLikeHandle = (s) => !!s && s.length <= HANDLE_MAX && HANDLE_RE.test(String(s).toLowerCase());

/** When you may change it again (a Date), or null if you can now. */
export function nextChangeAt(card) {
  const t = card?.handleChangedAt?.toMillis?.() || 0;
  if (!t || !card?.handle) return null;
  const at = t + HANDLE_COOLDOWN_DAYS * 86400000;
  return at > Date.now() ? new Date(at) : null;
}

/**
 * Claims `next` for you and releases `prev`, all in one go, so nobody ever holds two or none.
 * Throws a plain message if it is taken or not allowed yet.
 */
export async function claimHandle(user, next, prev = "") {
  if (!user?.uid) throw new Error("Sign in first");
  const h = cleanHandle(next);
  const bad = checkHandle(h);
  if (bad) throw new Error(bad);
  const old = cleanHandle(prev);
  if (old === h) return h;
  const free = await isHandleFree(h, user.uid);
  if (free === false) throw new Error("That username is taken");
  const name = publicName(user).slice(0, 80);
  const batch = writeBatch(db);
  batch.set(doc(db, "handles", h), { uid: user.uid, handle: h, nameLower: name.toLowerCase(), createdAt: serverTimestamp() });
  batch.set(
    doc(db, "publicProfiles", user.uid),
    { handle: h, handleChangedAt: serverTimestamp(), nameLower: name.toLowerCase(), displayName: name, updatedAt: serverTimestamp() },
    { merge: true }
  );
  if (old) batch.delete(doc(db, "handles", old));
  try {
    await batch.commit();
  } catch (e) {
    console.warn("[handle]", e?.code || e?.message || e);
    if (/permission|insufficient/i.test(String(e?.code || e?.message))) {
      throw new Error(old ? `You can change your username once every ${HANDLE_COOLDOWN_DAYS} days, or that one is taken` : "That username is taken or not allowed");
    }
    throw new Error("Could not save the username. Please try again.");
  }
  rememberHandle(user.uid, h);
  return h;
}

/** Your own handle: { handle, card, ready, refresh }. handle is "" until you claim one. */
export function useMyHandle(uid) {
  const [state, setState] = useState({ handle: "", card: null, ready: !uid });
  const load = useCallback(async () => {
    if (!uid) return setState({ handle: "", card: null, ready: true });
    try {
      const snap = await getDoc(doc(db, "publicProfiles", uid));
      const d = snap.exists() ? snap.data() : {};
      setState({ handle: d.handle || "", card: d, ready: true });
    } catch {
      setState((s) => ({ ...s, ready: true }));
    }
  }, [uid]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refresh: load };
}

/** People whose username or name starts with `input`. Needs 2+ characters. Returns [{ uid, handle }]. */
export async function searchPeople(input, max = 10) {
  const q = cleanHandle(input).replace(/\s+/g, " ");
  if (q.length < 2) return [];
  const col = collection(db, "handles");
  const end = "";
  const jobs = [
    getDocs(query(col, where("handle", ">=", q.replace(/\s/g, "")), where("handle", "<=", q.replace(/\s/g, "") + end), limit(max))),
    getDocs(query(col, where("nameLower", ">=", q), where("nameLower", "<=", q + end), limit(max))),
  ];
  const out = new Map();
  const done = await Promise.all(jobs.map((j) => j.catch(() => null)));
  for (const s of done) if (s) for (const d of s.docs) { const x = d.data(); if (x?.uid && !out.has(x.uid)) out.set(x.uid, { uid: x.uid, handle: x.handle || d.id }); }
  return [...out.values()].slice(0, max);
}

// A small pool of recent posts for "search posts", kept for a few minutes so typing doesn't re-read it.
let pool = { at: 0, posts: [] };
export async function recentPostPool(fetchCandidates) {
  if (Date.now() - pool.at < 3 * 60 * 1000 && pool.posts.length) return pool.posts;
  const r = await fetchCandidates({ following: [], topics: [], mode: "foryou", size: 100 });
  pool = { at: Date.now(), posts: r.posts || [] };
  return pool.posts;
}