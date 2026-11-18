// src/lib/moderation.js
//
// Report and block, the way App Store Guideline 1.2 asks for it.
//  - reportContent: files a report (message, question, reply or person) in the `reports` collection,
//    which you read in the Firebase console. Respond within 24 hours.
//  - blockUser / unblockUser: your private block list at users/{you}/blocked/{theirUid}.
//    Blocking also removes any friendship between you, and files a report, so you (the developer) are told about it.
//  - useBlocked: live list for components. Blocked people's messages, questions, replies and
//    notifications are hidden for you.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { pairId } from "./friends";

export const REPORT_REASONS = [
  "Spam or scam",
  "Harassment or bullying",
  "Hate or abusive language",
  "Sexual or inappropriate content",
  "Violence or threats",
  "Self-harm or danger",
  "Something else",
];

const clip = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);

export async function reportContent({
  kind, // "message" | "question" | "reply" | "user"
  reporterId,
  communityId = "",
  boardId = "",
  questionId = "",
  contentId = "",
  contentUid = "",
  contentName = "",
  preview = "",
  reason,
  details = "",
}) {
  if (!reporterId) throw new Error("Sign in required");
  return addDoc(collection(db, "reports"), {
    type: kind,
    reporterId,
    communityId,
    boardId,
    questionId,
    contentId,
    contentUid,
    contentName: clip(contentName, 80),
    preview: clip(preview, 300),
    reason: clip(reason, 80),
    details: clip(details, 500),
    status: "open",
    createdAt: serverTimestamp(),
  });
}

export async function blockUser({ myUid, other, communityId = "" }) {
  if (!myUid || !other?.uid || other.uid === myUid) throw new Error("Cannot block");
  await setDoc(doc(db, "users", myUid, "blocked", other.uid), {
    uid: other.uid,
    name: clip(other.name, 80) || "Member",
    photo: typeof other.photo === "string" && other.photo.length < 30000 ? other.photo : "",
    createdAt: serverTimestamp(),
  });
  // Blocking also ends any friendship or pending request between the two of you.
  try {
    await deleteDoc(doc(db, "friendships", pairId(myUid, other.uid)));
  } catch {}
  // Tell the developer. If this fails the block still stands.
  try {
    await reportContent({
      kind: "user",
      reporterId: myUid,
      communityId,
      contentUid: other.uid,
      contentName: other.name,
      reason: "Blocked by a member",
    });
  } catch {}
}

export async function unblockUser(myUid, otherUid) {
  if (!myUid || !otherUid) return;
  await deleteDoc(doc(db, "users", myUid, "blocked", otherUid));
}

export function useBlocked(uid) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!uid) {
      setRows([]);
      return undefined;
    }
    return onSnapshot(
      collection(db, "users", uid, "blocked"),
      (snap) => setRows(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
      () => setRows([])
    );
  }, [uid]);

  const blocked = useMemo(() => new Set(rows.map((r) => r.uid)), [rows]);
  const block = useCallback(
    (other, communityId) => blockUser({ myUid: uid, other, communityId }),
    [uid]
  );
  const unblock = useCallback((otherUid) => unblockUser(uid, otherUid), [uid]);

  return { blocked, list: rows, block, unblock };
}