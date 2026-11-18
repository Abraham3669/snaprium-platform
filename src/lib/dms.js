// src/lib/dms.js
//
// Direct messages between friends.
//   dms/{uidA_uidB}                  { users, lastText, lastAt, lastFrom }       the conversation
//   dms/{uidA_uidB}/messages/{id}    { uid, text, imageUrl, createdAt }          the messages
//   users/{me}/dmReads/{uidA_uidB}   { at }                                      when YOU last opened it
//
//  - useInbox(me)            your conversations (newest first) and how many are unread
//  - useDmMessages(me, them) live messages of one conversation
//  - sendDm / deleteDm / markDmRead
// Rules only allow sending between accepted friends who have not blocked each other.
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { pairId } from "./friends";
import { notifyDm } from "./notifications";

const ms = (t) => t?.toMillis?.() || (t instanceof Date ? t.getTime() : 0);

export function useInbox(me) {
  const [rows, setRows] = useState([]);
  const [reads, setReads] = useState({});

  useEffect(() => {
    if (!me) {
      setRows([]);
      return undefined;
    }
    return onSnapshot(
      query(collection(db, "dms"), where("users", "array-contains", me)),
      (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setRows([])
    );
  }, [me]);

  useEffect(() => {
    if (!me) {
      setReads({});
      return undefined;
    }
    return onSnapshot(
      collection(db, "users", me, "dmReads"),
      (snap) => {
        const next = {};
        snap.docs.forEach((d) => (next[d.id] = ms(d.data().at)));
        setReads(next);
      },
      () => setReads({})
    );
  }, [me]);

  return useMemo(() => {
    const list = rows
      .map((r) => {
        const other = (r.users || []).find((u) => u !== me) || "";
        const unread = r.lastFrom !== me && ms(r.lastAt) > (reads[r.id] || 0);
        return { ...r, other, unread };
      })
      .filter((r) => r.other)
      .sort((a, b) => ms(b.lastAt) - ms(a.lastAt));
    return { list, unread: list.filter((r) => r.unread).length };
  }, [rows, reads, me]);
}

export function useDmMessages(me, other) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!me || !other) return undefined;
    setLoading(true);
    return onSnapshot(
      query(collection(db, "dms", pairId(me, other), "messages"), orderBy("createdAt", "desc"), limit(120)),
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse());
        setLoading(false);
      },
      () => {
        setMessages([]);
        setLoading(false);
      }
    );
  }, [me, other]);
  return { messages, loading };
}

export async function markDmRead(me, other) {
  if (!me || !other) return;
  await setDoc(doc(db, "users", me, "dmReads", pairId(me, other)), { at: serverTimestamp() });
}

export async function sendDm(meInfo, other, { text = "", imageUrl = "" }) {
  const body = String(text || "").trim().slice(0, 2000);
  if (!meInfo?.uid || !other || (!body && !imageUrl)) throw new Error("Nothing to send");
  const pid = pairId(meInfo.uid, other);
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "dms", pid, "messages")), {
    uid: meInfo.uid,
    text: body,
    imageUrl: imageUrl || "",
    createdAt: serverTimestamp(),
  });
  batch.set(
    doc(db, "dms", pid),
    {
      users: [meInfo.uid, other].sort(),
      lastText: (body || "Photo").slice(0, 200),
      lastAt: serverTimestamp(),
      lastFrom: meInfo.uid,
    },
    { merge: true }
  );
  await batch.commit();
  notifyDm({ to: other, from: meInfo, preview: body || "sent a photo" });
}

export async function deleteDm(me, other, messageId) {
  if (!me || !other || !messageId) return;
  await deleteDoc(doc(db, "dms", pairId(me, other), "messages", messageId));
}