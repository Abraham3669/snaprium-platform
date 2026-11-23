// src/lib/profileData.js  -  what the profile tabs read
//
//  fetchRepliesBy(uid)       a person's replies, newest first, each with the post it answered
//  fetchFollowList(uid, kind) the people who follow uid ("followers") or whom uid follows ("following")
//  fetchCirclesOf(uid, isMe)  circles to show on a profile: all of yours, only public ones for anyone else
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { fetchPostsByIds } from "./feed";
import { toMillis } from "./feedRank";
import { listMyCommunities } from "./communities";

/** Replies written by `uid` (any post), newest first, with `post` filled in (replies on deleted posts are skipped). */
export async function fetchRepliesBy(uid, size = 40) {
  if (!uid) return [];
  let index;
  try {
    index = await getDocs(query(collection(db, "replyIndex"), where("uid", "==", uid), limit(100)));
  } catch (err) {
    console.warn("[profile replies]", err?.code || err?.message || err);
    return null; // null = could not load (different from "none yet")
  }
  const rows = index.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .slice(0, size);
  const posts = await fetchPostsByIds([...new Set(rows.map((r) => r.postId))]);
  const byId = new Map(posts.map((p) => [p.id, p]));
  const full = await Promise.all(
    rows.map(async (r) => {
      if (!byId.has(r.postId)) return null;
      try {
        const snap = await getDoc(doc(db, "posts", r.postId, "replies", r.id));
        return snap.exists() ? { ...snap.data(), id: r.id, postId: r.postId, post: byId.get(r.postId) } : null;
      } catch {
        return null;
      }
    })
  );
  return full.filter(Boolean);
}

/** [{ uid, at }] newest first. Followers and Following lists need you to be signed in (the rules say so). */
export async function fetchFollowList(uid, kind = "followers", size = 100) {
  if (!uid) return [];
  const mine = kind === "following";
  const snap = await getDocs(query(collection(db, "follows"), where(mine ? "followerId" : "targetId", "==", uid), limit(size)));
  return snap.docs
    .map((d) => {
      const x = d.data();
      return { uid: mine ? x.targetId : x.followerId, at: toMillis(x.createdAt) };
    })
    .filter((x) => x.uid)
    .sort((a, b) => b.at - a.at);
}

/** Circles for the Circles tab. Others only ever see public circles. Quietly returns [] if the database says no. */
export async function fetchCirclesOf(uid, isMe = false) {
  if (!uid) return [];
  try {
    if (isMe) {
      return (await listMyCommunities(uid)).sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    }
    const snap = await getDocs(
      query(collection(db, "communities"), where("members", "array-contains", uid), where("visibility", "==", "public"), where("deleted", "==", false), limit(30))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
  } catch (err) {
    console.warn("[profile circles]", err?.code || err?.message || err);
    return [];
  }
}