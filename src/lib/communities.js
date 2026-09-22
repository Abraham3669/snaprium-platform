// src/lib/communities.js
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase";

export const COMMUNITY_TAGS = [
  "Math",
  "Science",
  "English",
  "Exam prep",
  "Languages",
  "Tutor class",
  "Other",
];

function generateCommunityCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function ensureCommunityCode(id) {
  const ref = doc(db, "communities", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.code) return { id: snap.id, ...data };
  const code = generateCommunityCode();
  await updateDoc(ref, { code, updatedAt: serverTimestamp() });
  return { id: snap.id, ...data, code };
}



export async function listMyCommunities(uid) {
  if (!uid) return [];
  const q = query(
    collection(db, "communities"),
    where("members", "array-contains", uid)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.deleted !== true);
}





export async function updateCommunityMedia(id, fields) {
  const ref = doc(db, "communities", id);
  await updateDoc(ref, {
    ...fields,
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...snap.data() };
}

export async function createCommunity({
  name,
  tag,
  visibility,
  role,
  createdBy,
  createdByName,
  coverUrl = "",
  photoUrl = "",
}) {
  if (!name?.trim()) throw new Error("Name is required");
  if (!tag) throw new Error("Pick a subject tag");

  const ref = doc(collection(db, "communities"));
  const data = {
    id: ref.id,
    name: name.trim(),
    tag,
    visibility: visibility === "private" ? "private" : "public",
    role: role === "tutor" ? "tutor" : "student",
    coverUrl,
    photoUrl,
    code: generateCommunityCode(),
    createdBy,
    createdByName: createdByName || "Member",
    memberCount: 1,
    members: [createdBy],
    admins: [createdBy],
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);
  return data;
}

export async function listPublicCommunities(tag = "") {
  const q = tag
    ? query(
        collection(db, "communities"),
        where("visibility", "==", "public"),
        where("deleted", "==", false),
        where("tag", "==", tag)
      )
    : query(
        collection(db, "communities"),
        where("visibility", "==", "public"),
        where("deleted", "==", false)
      );

  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
}

export async function getCommunity(id) {
  const snap = await getDoc(doc(db, "communities", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function joinCommunity(id, uid) {
  const ref = doc(db, "communities", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Community not found");
  const data = snap.data();
  if (data.deleted) throw new Error("This community is unavailable");
  if ((data.members || []).includes(uid)) return { id, ...data };

  await updateDoc(ref, {
    members: arrayUnion(uid),
    memberCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  return { id, ...data, memberCount: (data.memberCount || 0) + 1 };
}

export async function joinCommunityByCode(code, uid) {
  const clean = String(code || "").trim().toUpperCase();
  if (!clean) throw new Error("Enter a community code");
  const q = query(collection(db, "communities"), where("code", "==", clean));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Community not found. Check the code.");
  return joinCommunity(snap.docs[0].id, uid);
}

export async function leaveCommunity(id, uid) {
  const ref = doc(db, "communities", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (!(data.members || []).includes(uid)) return;
  if (data.createdBy === uid) {
    throw new Error("Creators can’t leave. Delete the community instead.");
  }

  await updateDoc(ref, {
    members: arrayRemove(uid),
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
}

export async function unlistCommunity(id) {
  const ref = doc(db, "communities", id);
  await updateDoc(ref, {
    deleted: true,
    visibility: "private",
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToCommunityMessages(communityId, callback) {
  const q = query(
    collection(db, "communities", communityId, "messages"),
    orderBy("createdAt", "asc"),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function sendCommunityMessage(communityId, message) {
  await addDoc(collection(db, "communities", communityId, "messages"), {
    ...message,
    createdAt: serverTimestamp(),
  });
}