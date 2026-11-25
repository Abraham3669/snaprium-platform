// src/lib/feed.js
//
// Data layer for the Snaprium feed. No React in here except the small hooks at the bottom.
//
// Collections (all rules are in firestore.rules):
//   posts/{postId}                       the post. sparkCount and replyCount are counters kept by batched writes
//   posts/{postId}/sparks/{uid}          one doc per person who found it helpful ("Spark")
//   posts/{postId}/replies/{replyId}     replies
//   follows/{me_target}                  me follows target
//   users/{uid}/feedPrefs/main           { topics:[...], hidden:[postId...] }   private
//   users/{uid}/saved/{postId}           saved posts                           private
//
// Pictures: stored as small compressed JPEGs inside the post (media: [{type, url, w, h}]), the same way the rest of
// the app stores pictures. The `media` list is the single place a picture OR a video would be added later
// (type "video" with a Storage url), so no other part of the app has to change.
// Videos: one short clip per post, stored in Firebase Storage (see lib/video.js). The post keeps { type:"video", url, path,
// poster, w, h, dur, mime }; a post has either one video or up to two pictures.

import { useCallback, useEffect, useMemo, useState } from "react";
import { publicName } from "./publicName";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  increment,
  getCountFromServer,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "./firebase";
import { KIND_IDS, TOPIC_IDS } from "./topics";
import { toMillis } from "./feedRank";
import { VIDEO, deleteVideoFiles } from "./video";

export const LIMITS = {
  text: 2000,
  reply: 5000,
  topics: 3,
  images: 2,
  imageChars: 300000, // per picture, in the stored text form
  hidden: 300,
  followedQuery: 30, // Firestore `in` limit
};

const clip = (v, n) => String(v ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);

/* ------------------------------------------------------------------ */
/* pictures                                                            */
/* ------------------------------------------------------------------ */

// Shrinks a picture until it fits the stored size. Resolves { type:"image", url, w, h }.
export function compressPostImage(file, max = 1100) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type || "")) return reject(new Error("Not a picture"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the picture"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not open the picture"));
      img.onload = () => {
        let side = max;
        let quality = 0.72;
        for (let i = 0; i < 6; i++) {
          const scale = Math.min(1, side / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const url = canvas.toDataURL("image/jpeg", quality);
          if (url.length <= LIMITS.imageChars) return resolve({ type: "image", url, w, h });
          side = Math.round(side * 0.8);
          quality = Math.max(0.5, quality - 0.06);
        }
        reject(new Error("Picture is too large"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------------ */
/* posts                                                               */
/* ------------------------------------------------------------------ */

const tidyTopics = (topics) => [...new Set((topics || []).filter((t) => TOPIC_IDS.includes(t)))].slice(0, LIMITS.topics);
const VIDEO_HOST = /^https:\/\/firebasestorage\.googleapis\.com\//;
const tidyMedia = (media, uid) => {
  const list = Array.isArray(media) ? media : [];
  // One video (it must be a file this person put in their own Storage folder), or pictures.
  const vid = list.find(
    (m) =>
      m &&
      m.type === "video" &&
      typeof m.url === "string" &&
      m.url.length <= 1500 &&
      VIDEO_HOST.test(m.url) &&
      typeof m.path === "string" &&
      m.path.startsWith(`${VIDEO.folder}/${uid}/`) &&
      typeof m.poster === "string" &&
      m.poster.length <= VIDEO.posterChars
  );
  if (vid) {
    return [
      {
        type: "video",
        url: vid.url,
        path: vid.path,
        poster: vid.poster,
        w: Number(vid.w) || 0,
        h: Number(vid.h) || 0,
        dur: Number(vid.dur) || 0,
        mime: String(vid.mime || "").slice(0, 40),
      },
    ];
  }
  return list
    .filter((m) => m && m.type === "image" && typeof m.url === "string" && m.url.length <= LIMITS.imageChars)
    .slice(0, LIMITS.images)
    .map((m) => ({ type: "image", url: m.url, w: Number(m.w) || 0, h: Number(m.h) || 0 }));
};

/** Validates what a person typed. Returns an error message or "". */
export function checkPostInput({ kind, text, media }) {
  if (!KIND_IDS.includes(kind)) return "Pick what kind of post this is";
  const t = clip(text, LIMITS.text + 1);
  if (!t && !(media && media.length)) return "Write something first";
  if (t.length > LIMITS.text) return `Posts can be up to ${LIMITS.text} characters`;
  if (kind === "question" && t.length < 8) return "Add a bit more so people can help";
  return "";
}

/** Creates a post. Resolves the post as it will look locally (createdAt is filled in by the server). */
export async function createPost({ user, kind, text, topics = [], media = [] }) {
  if (!user?.uid) throw new Error("Sign in first");
  const err = checkPostInput({ kind, text, media });
  if (err) throw new Error(err);
  const ref = doc(collection(db, "posts"));
  const data = {
    uid: user.uid,
    authorName: clip(publicName(user), 80),
    kind,
    text: clip(text, LIMITS.text),
    topics: tidyTopics(topics),
    media: tidyMedia(media, user.uid),
    sparkCount: 0,
    replyCount: 0,
    selfSpark: false, // true while the author has Sparked their own post (shown in the number, ignored by ranking)
    lastReplyId: "",
    answered: false,
    acceptedReplyId: "",
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data, createdAt: null };
}

export async function getPost(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, "posts", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function deletePost(id, media) {
  // Pass the post's media when you have it; if not, it is read here so a video file is never left behind.
  let files = media;
  if (!Array.isArray(files)) {
    try {
      const snap = await getDoc(doc(db, "posts", id));
      files = snap.exists() ? snap.data().media : [];
    } catch {
      files = [];
    }
  }
  await deleteDoc(doc(db, "posts", id));
  await deleteVideoFiles(files); // never throws; does nothing for posts without a video
}

/** Live copy of one post (counters update while you look at it). */
export function subscribePost(id, cb) {
  if (!id) return () => {};
  return onSnapshot(
    doc(db, "posts", id),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => cb(null)
  );
}

/* ------------------------------------------------------------------ */
/* sparks                                                              */
/* ------------------------------------------------------------------ */

/**
 * Spark or un-Spark a post. Everyone, the author included, adds to the number people see (like other apps).
 * When the AUTHOR Sparks their own post the post is also flagged selfSpark, and the ranking subtracts that one,
 * so nobody can raise their own post in the feed.
 * Resolves the change to the counter (+1 or -1).
 */
export async function setSpark({ post, me, on }) {
  if (!me || !post?.id) throw new Error("Sign in first");
  const batch = writeBatch(db);
  const sparkRef = doc(db, "posts", post.id, "sparks", me);
  if (on) batch.set(sparkRef, { uid: me, createdAt: serverTimestamp() });
  else batch.delete(sparkRef);
  batch.update(doc(db, "posts", post.id), { sparkCount: increment(on ? 1 : -1), ...(post.uid === me ? { selfSpark: on } : {}) });
  await batch.commit();
  return on ? 1 : -1;
}

/** Which of these posts did I Spark? Resolves a Set of post ids. */
export async function fetchMySparks(me, postIds) {
  const out = new Set();
  if (!me) return out;
  await Promise.all(
    [...new Set(postIds)].slice(0, 80).map(async (id) => {
      try {
        const s = await getDoc(doc(db, "posts", id, "sparks", me));
        if (s.exists()) out.add(id);
      } catch {}
    })
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* replies                                                             */
/* ------------------------------------------------------------------ */

export function subscribeReplies(postId, cb) {
  if (!postId) return () => {};
  const q = query(collection(db, "posts", postId, "replies"), orderBy("createdAt", "asc"), limit(300));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([])
  );
}

/**
 * Adds a reply. `parent` is the reply you are answering (or nothing for a reply to the post itself).
 * Threads are one level deep: answering an answer to a reply files yours under the same top reply, and
 * "Replying to @name" says who you meant.
 */
export async function addReply({ post, user, text, parent = null }) {
  if (!user?.uid || !post?.id) throw new Error("Sign in first");
  const body = clip(text, LIMITS.reply);
  if (!body) throw new Error("Write a reply first");
  const ref = doc(collection(db, "posts", post.id, "replies"));
  const parentId = parent ? parent.parentId || parent.id : "";
  const replyToUid = parent ? parent.uid || "" : "";
  const batch = writeBatch(db);
  batch.set(ref, {
    uid: user.uid,
    authorName: clip(publicName(user), 80),
    text: body,
    parentId,
    replyToUid,
    sparkCount: 0,
    createdAt: serverTimestamp(),
  });
  // Public "who wrote which reply" list for the Replies tab on profiles (same id as the reply)
  batch.set(doc(db, "replyIndex", ref.id), { uid: user.uid, postId: post.id, createdAt: serverTimestamp() });
  // lastReplyId tells the rules which reply this +1 belongs to (they check it was really created in this same batch)
  batch.update(doc(db, "posts", post.id), { replyCount: increment(1), lastReplyId: ref.id });
  await batch.commit();
  return { id: ref.id, text: body, parentId, replyToUid };
}

/** Spark (or un-Spark) someone's reply. The reply's counter and your private marker change together. */
export async function setReplySpark({ postId, reply, me, on }) {
  if (!me || !postId || !reply?.id) throw new Error("Sign in first");
  if (reply.uid === me) throw new Error("You can't Spark your own reply");
  const rref = doc(db, "posts", postId, "replies", reply.id);
  const sref = doc(db, "posts", postId, "replies", reply.id, "sparks", me);
  const batch = writeBatch(db);
  if (on) {
    batch.set(sref, { uid: me, createdAt: serverTimestamp() });
    batch.update(rref, { sparkCount: increment(1) });
  } else {
    batch.delete(sref);
    batch.update(rref, { sparkCount: increment(-1) });
  }
  await batch.commit();
}

/** Which of these replies have I Sparked? Only replies that have any Sparks are checked. */
export async function fetchMyReplySparks(postId, me, replies) {
  const out = new Set();
  if (!me || !postId) return out;
  const ids = (replies || []).filter((r) => (r.sparkCount || 0) > 0 && r.uid !== me).map((r) => r.id).slice(0, 100);
  await Promise.all(
    ids.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, "posts", postId, "replies", id, "sparks", me));
        if (snap.exists()) out.add(id);
      } catch {}
    })
  );
  return out;
}

export async function deleteReply({ post, reply, me }) {
  // The author of the post also clears the "helpful answer" mark if this was it (separate step: the rules only let the author do that).
  if (post.uid === me && post.acceptedReplyId === reply.id) {
    await updateDoc(doc(db, "posts", post.id), { answered: false, acceptedReplyId: "" });
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, "posts", post.id, "replies", reply.id));
  batch.delete(doc(db, "replyIndex", reply.id));
  batch.update(doc(db, "posts", post.id), { replyCount: increment(-1), lastReplyId: reply.id });
  await batch.commit();
}

/** The person who asked marks the reply that helped (or un-marks it). */
export async function setHelpfulAnswer({ post, replyId }) {
  await updateDoc(doc(db, "posts", post.id), replyId ? { answered: true, acceptedReplyId: replyId } : { answered: false, acceptedReplyId: "" });
}

/* ------------------------------------------------------------------ */
/* follows                                                             */
/* ------------------------------------------------------------------ */

export const followId = (me, target) => `${me}_${target}`;

export async function followUser(me, target) {
  if (!me || !target || me === target) throw new Error("Cannot follow");
  await setDoc(doc(db, "follows", followId(me, target)), { followerId: me, targetId: target, createdAt: serverTimestamp() });
}
export async function unfollowUser(me, target) {
  await deleteDoc(doc(db, "follows", followId(me, target)));
}

export async function countFollowers(uid) {
  try {
    const s = await getCountFromServer(query(collection(db, "follows"), where("targetId", "==", uid)));
    return s.data().count;
  } catch {
    return null;
  }
}
/** How many posts a person has written (public). */
export async function countPosts(uid) {
  try {
    const s = await getCountFromServer(query(collection(db, "posts"), where("uid", "==", uid)));
    return s.data().count;
  } catch {
    return null;
  }
}
export async function countFollowing(uid) {
  try {
    const s = await getCountFromServer(query(collection(db, "follows"), where("followerId", "==", uid)));
    return s.data().count;
  } catch {
    return null;
  }
}

/** The people I follow, live. */
export function useFollowing(me) {
  const [ids, setIds] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!me) {
      setIds([]);
      setReady(true);
      return undefined;
    }
    setReady(false);
    return onSnapshot(
      query(collection(db, "follows"), where("followerId", "==", me), limit(500)),
      (snap) => {
        setIds(snap.docs.map((d) => d.data().targetId).filter(Boolean));
        setReady(true);
      },
      () => {
        setIds([]);
        setReady(true);
      }
    );
  }, [me]);
  const set = useMemo(() => new Set(ids), [ids]);
  const follow = useCallback((t) => followUser(me, t), [me]);
  const unfollow = useCallback((t) => unfollowUser(me, t), [me]);
  return { following: set, ready, follow, unfollow };
}

/* ------------------------------------------------------------------ */
/* private settings: topics, hidden posts, saved posts                 */
/* ------------------------------------------------------------------ */

const prefsRef = (me) => doc(db, "users", me, "feedPrefs", "main");

export function useFeedPrefs(me) {
  const [prefs, setPrefs] = useState({ topics: [], hidden: [] });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!me) {
      setPrefs({ topics: [], hidden: [] });
      setReady(true);
      return undefined;
    }
    setReady(false);
    return onSnapshot(
      prefsRef(me),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        setPrefs({ topics: Array.isArray(d.topics) ? d.topics : [], hidden: Array.isArray(d.hidden) ? d.hidden : [] });
        setReady(true);
      },
      () => setReady(true)
    );
  }, [me]);

  const topics = useMemo(() => new Set(prefs.topics), [prefs.topics]);
  const hidden = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);

  const toggleTopic = useCallback(
    async (id) => {
      if (!me || !TOPIC_IDS.includes(id)) return;
      const next = prefs.topics.includes(id) ? prefs.topics.filter((t) => t !== id) : [...prefs.topics, id].slice(0, 12);
      setPrefs((p) => ({ ...p, topics: next }));
      await setDoc(prefsRef(me), { topics: next, hidden: prefs.hidden, updatedAt: serverTimestamp() }, { merge: true });
    },
    [me, prefs]
  );
  const hidePost = useCallback(
    async (postId) => {
      if (!me || !postId) return;
      const next = [...prefs.hidden.filter((x) => x !== postId), postId].slice(-LIMITS.hidden);
      setPrefs((p) => ({ ...p, hidden: next }));
      await setDoc(prefsRef(me), { topics: prefs.topics, hidden: next, updatedAt: serverTimestamp() }, { merge: true });
    },
    [me, prefs]
  );
  return { topics, hidden, ready, toggleTopic, hidePost };
}

export function useSaved(me) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!me) {
      setRows([]);
      return undefined;
    }
    return onSnapshot(
      query(collection(db, "users", me, "saved"), orderBy("createdAt", "desc"), limit(100)),
      (snap) => setRows(snap.docs.map((d) => d.id)),
      () => setRows([])
    );
  }, [me]);
  const ids = useMemo(() => new Set(rows), [rows]);
  const toggle = useCallback(
    async (postId) => {
      if (!me) return;
      const ref = doc(db, "users", me, "saved", postId);
      if (ids.has(postId)) await deleteDoc(ref);
      else await setDoc(ref, { postId, createdAt: serverTimestamp() });
    },
    [me, ids]
  );
  return { order: rows, ids, toggle };
}

/** Posts by id (for the Saved tab). Missing (deleted) posts are skipped. */
export async function fetchPostsByIds(ids) {
  const out = await Promise.all((ids || []).slice(0, 60).map((id) => getPost(id).catch(() => null)));
  return out.filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* candidates for the feed                                             */
/* ------------------------------------------------------------------ */

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const safe = async (promise) => {
  try {
    return await promise;
  } catch (err) {
    console.warn("[feed]", err?.code || err?.message || err);
    return null;
  }
};

/**
 * Gathers the pool of posts to rank (one round of reads, no live listeners):
 *   newest      the latest posts anywhere
 *   top         the most Sparked posts (so good older posts can still surface)
 *   followed    the latest from people you follow
 *   topical     the latest in topics you chose
 * Resolves { posts, cursor } where `cursor` is used by fetchOlder to go further back.
 */
export async function fetchCandidates({ following = [], topics = [], mode = "foryou", size = 60 } = {}) {
  const col = collection(db, "posts");
  const jobs = [];
  let newestSnap = null;

  if (mode === "questions") {
    jobs.push(safe(getDocs(query(col, where("kind", "==", "question"), orderBy("createdAt", "desc"), limit(size)))));
  } else if (mode === "following") {
    const list = [...new Set(following)].slice(0, 90);
    for (let i = 0; i < list.length; i += LIMITS.followedQuery) {
      jobs.push(safe(getDocs(query(col, where("uid", "in", list.slice(i, i + LIMITS.followedQuery)), orderBy("createdAt", "desc"), limit(size)))));
    }
  } else {
    jobs.push(
      safe(getDocs(query(col, orderBy("createdAt", "desc"), limit(size * 2)))).then((s) => {
        newestSnap = s;
        return s;
      })
    );
    jobs.push(safe(getDocs(query(col, orderBy("sparkCount", "desc"), limit(40)))));
    const fl = [...new Set(following)].slice(0, LIMITS.followedQuery);
    if (fl.length) jobs.push(safe(getDocs(query(col, where("uid", "in", fl), orderBy("createdAt", "desc"), limit(60)))));
    const tl = [...new Set(topics)].slice(0, 10);
    if (tl.length) jobs.push(safe(getDocs(query(col, where("topics", "array-contains-any", tl), orderBy("createdAt", "desc"), limit(60)))));
  }

  const results = await Promise.all(jobs);
  const byId = new Map();
  for (const s of results) if (s) for (const p of rows(s)) byId.set(p.id, p);
  const last = newestSnap && newestSnap.docs.length ? newestSnap.docs[newestSnap.docs.length - 1] : null;
  return { posts: [...byId.values()], cursor: last, failed: results.every((r) => r === null) };
}

/** Older posts, for "Show more" once the first pool has been shown. */
export async function fetchOlder({ cursor, size = 60 } = {}) {
  if (!cursor) return { posts: [], cursor: null };
  const snap = await safe(getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), startAfter(cursor), limit(size))));
  if (!snap) return { posts: [], cursor };
  return { posts: rows(snap), cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null, done: snap.docs.length < size };
}

/** A person's own posts (profile page). Uses the uid + newest-first index; if that index is missing or still
 *  building, it falls back to a plain uid query sorted on the device, so a profile never shows "no posts"
 *  just because of an index. Real failures are thrown so the page can say so instead of looking empty. */
export async function fetchPostsBy(uid, size = 30, cursor = null) {
  try {
    const base = [collection(db, "posts"), where("uid", "==", uid), orderBy("createdAt", "desc")];
    const snap = await getDocs(query(...base, ...(cursor ? [startAfter(cursor)] : []), limit(size)));
    return { posts: rows(snap), cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null, done: snap.docs.length < size };
  } catch (err) {
    if (cursor) throw err;
    console.warn("[feed] profile posts: using the no-index fallback", err?.code || err?.message || err);
    const snap = await getDocs(query(collection(db, "posts"), where("uid", "==", uid), limit(200)));
    const list = rows(snap).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return { posts: list, cursor: null, done: true };
  }
}

/* ------------------------------------------------------------------ */
/* on-device history: posts already seen, people I interacted with     */
/* ------------------------------------------------------------------ */

const SEEN_KEY = "snaprium_feed_seen_v1";
const INTERACT_KEY = "snaprium_feed_with_v1";
const SEEN_MAX = 600;

// Seen posts: { postId: time you last saw it }. Kept on this device AND in users/{uid}/feedSeen/main, so the phone,
// the iPhone app and the PC all know what you have already seen (like X). Signed-out visitors keep it on the device.
export function readSeen() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function writeSeen(map) {
  try {
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, SEEN_MAX);
    localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

let seenUid = "";
let seenPulled = false; // we only write to the cloud after reading it once, so one device never wipes another
let seenTimer = 0;
const seenDoc = (uid) => doc(db, "users", uid, "feedSeen", "main");

async function pushSeenNow() {
  if (!seenUid || !seenPulled) return;
  try {
    await setDoc(seenDoc(seenUid), { seen: readSeen(), updatedAt: serverTimestamp() });
  } catch {}
}
async function pullSeen(uid) {
  try {
    const snap = await getDoc(seenDoc(uid));
    if (uid !== seenUid) return;
    const remote = snap.exists() ? snap.data().seen || {} : {};
    const merged = { ...readSeen() };
    for (const [id, t] of Object.entries(remote)) if (typeof t === "number" && t > (merged[id] || 0)) merged[id] = t;
    writeSeen(merged);
    seenPulled = true;
    if (!snap.exists()) pushSeenNow();
  } catch {}
}
try {
  onAuthStateChanged(getAuth(), (u) => {
    clearTimeout(seenTimer);
    seenUid = u?.uid || "";
    seenPulled = false;
    if (seenUid) pullSeen(seenUid);
  });
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") pushSeenNow();
    });
  }
} catch {}

export function markSeen(ids) {
  try {
    const cur = readSeen();
    const now = Date.now();
    for (const id of ids) cur[id] = now; // last seen: seeing it again keeps it low
    writeSeen(cur);
    if (seenUid) {
      clearTimeout(seenTimer);
      seenTimer = setTimeout(pushSeenNow, 20000);
    }
  } catch {}
}
export function readInteracted() {
  try {
    return new Set(JSON.parse(localStorage.getItem(INTERACT_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
export function rememberInteraction(uid) {
  if (!uid) return;
  try {
    const cur = [...readInteracted()].filter((x) => x !== uid);
    cur.push(uid);
    localStorage.setItem(INTERACT_KEY, JSON.stringify(cur.slice(-80)));
  } catch {}
}

export { toMillis };

/** How many posts by other people are newer than `sinceMs`? (for the "New posts" pill; one small read) */
export async function countNewerPosts(sinceMs, me) {
  try {
    const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20)));
    return snap.docs.filter((d) => {
      const x = d.data();
      return x.uid !== me && toMillis(x.createdAt) > sinceMs;
    }).length;
  } catch {
    return 0;
  }
}