// src/lib/communities.js
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
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

export const DEFAULT_BOARDS = [
  { slug: "general", name: "General", kind: "chat", isDefault: true },
  { slug: "homework", name: "Homework", kind: "chat", isDefault: true },
  { slug: "session", name: "Session", kind: "session", isDefault: true },
];



export const FREE_BOARD_LIMIT = 5;
export const PAID_BOARD_LIMIT = 15;

function generateCommunityCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function boardsCol(communityId) {
  return collection(db, "communities", communityId, "boards");
}


export function isDefaultBoard(board) {
  // Explicit flag wins
  if (board?.isDefault === true) return true;
  if (board?.isDefault === false) return false;
  // Legacy docs without the field: only protect known default slugs
  return DEFAULT_BOARDS.some((d) => d.slug === board?.slug);
}




export async function seedDefaultBoards(communityId) {
  const existing = await getDocs(boardsCol(communityId));
  if (!existing.empty) {
    return existing.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const created = [];
  for (const board of DEFAULT_BOARDS) {
    const ref = doc(boardsCol(communityId));
    const row = {
      id: ref.id,
      ...board,
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, row);
    created.push(row);
  }
  return created;
}

export async function listBoards(communityId) {
  const snap = await getDocs(boardsCol(communityId));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (rows.length === 0) return seedDefaultBoards(communityId);
  const order = { general: 0, homework: 1, session: 2 };
  return rows.sort(
    (a, b) =>
      (order[a.slug] ?? 50) - (order[b.slug] ?? 50) ||
      (a.name || "").localeCompare(b.name || "")
  );
}

export async function createBoard(communityId, { name, kind = "chat" }, { isPaid = false } = {}) {
  const clean = String(name || "").trim();
  if (!clean) throw new Error("Board name is required");
  const current = await listBoards(communityId);
  const cap = isPaid ? PAID_BOARD_LIMIT : FREE_BOARD_LIMIT;
  if (current.length >= cap) {
    throw new Error(isPaid ? "Board limit reached." : "Upgrade to add more boards.");
  }
    const ref = doc(boardsCol(communityId));
  const row = {
    id: ref.id,
    slug: clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32) || "board",
    name: clean.slice(0, 40),
    kind,
    isDefault: false,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, row);
  return row;
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
    banned: [],
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);
  await seedDefaultBoards(ref.id);
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
  if (!snap.exists()) throw new Error("Circle not found");
  const data = snap.data();
  if (data.deleted) throw new Error("This circle is unavailable");
  if ((data.banned || []).includes(uid)) throw new Error("You can’t join this circle");
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
  if (!clean) throw new Error("Enter an invite code");
  const q = query(collection(db, "communities"), where("code", "==", clean));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Circle not found. Check the code.");
  return joinCommunity(snap.docs[0].id, uid);
}

export async function leaveCommunity(id, uid) {
  const ref = doc(db, "communities", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (!(data.members || []).includes(uid)) return;
  if (data.createdBy === uid) {
    throw new Error("Creators can’t leave. Remove the circle instead.");
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

export function subscribeToCommunityMessages(communityId, callback, boardId = "", boardSlug = "") {
  const q = query(
    collection(db, "communities", communityId, "messages"),
    orderBy("createdAt", "asc"),
    limit(200)
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!boardId && !boardSlug) {
        callback(rows);
        return;
      }
      callback(
        rows.filter((m) => {
          const bid = m.boardId || "general";
          return bid === boardId || bid === boardSlug || bid === "general" && boardSlug === "general";
        })
      );
    },
    (err) => {
      console.error("[community messages]", err);
      callback([]);
    }
  );
}

export async function reportCommunity({ communityId, communityName, reporterId, reason }) {
  await addDoc(collection(db, "reports"), {
    type: "community",
    communityId,
    communityName: communityName || "",
    reporterId,
    reason: reason || "Reported",
    status: "open",
    createdAt: serverTimestamp(),
  });
}

export async function sendCommunityMessage(communityId, message) {
  await addDoc(collection(db, "communities", communityId, "messages"), {
    ...message,
    boardId: message.boardId || "general",
    createdAt: serverTimestamp(),
  });
}






export async function editCommunityMessage(communityId, messageId, text) {
  const ref = doc(db, "communities", communityId, "messages", messageId);
  await updateDoc(ref, {
    text,
    edited: true,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCommunityMessage(communityId, messageId) {
  const ref = doc(db, "communities", communityId, "messages", messageId);
  await deleteDoc(ref);
}



export async function deleteBoard(communityId, board) {
  if (isDefaultBoard(board)) {
    throw new Error("Default boards can't be deleted");
  }
  await deleteDoc(doc(db, "communities", communityId, "boards", board.id));
}