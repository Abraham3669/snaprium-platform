// src/lib/dms.js
//
// Direct messages between friends.
//   dms/{uidA_uidB}                  { users, lastText, lastAt, lastFrom,        the conversation
//                                      request?, viaCircle?, accepted?, declined? } request = who asked (a message request)
//   dms/{uidA_uidB}/messages/{id}    { uid, text, imageUrl, createdAt,           the messages
//                                      replyTo?, reactions?, edited?, updatedAt? }
//                                    reactions looks like { "👍": [uid, ...] } (same as circle chat)
//   users/{me}/dmReads/{uidA_uidB}   { at }                                      when YOU last opened it
//   dms/{uidA_uidB}/typing/{uid}     { uid, at }                                  "is typing…" (one tiny doc per person)
//
//  - useInbox(me)            your conversations (newest first) and how many are unread
//  - useDmMessages(me, them) live messages of one conversation
//  - sendDm / editDm / toggleDmReaction / deleteDm / markDmRead
//  - useDmTyping(me, them) true while they are typing; setDmTyping / clearDmTyping for your own side
// Rules allow sending between accepted friends who have not blocked each other, and "message requests":
// a person who shares a circle with you can send ONE first message. They can send more only after you accept.
//  - useDmMeta(me, them)     the state of one conversation (request pending / accepted / declined)
//  - acceptDmRequest / declineDmRequest   answer a request someone sent you
import { useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { pairId } from "./friends";
import { listMyCommunities } from "./communities";
import { notifyDm, pushDm } from "./notifications";

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
        // a message request that is waiting for YOU to answer (you did not send it, and have not accepted)
        const incomingRequest = !!r.request && r.request !== me && !r.accepted;
        const outgoingRequest = !!r.request && r.request === me && !r.accepted;
        return { ...r, other, unread, incomingRequest, outgoingRequest };
      })
      // a request you declined disappears for you
      .filter((r) => r.other && !(r.incomingRequest && r.declined))
      .sort((a, b) => ms(b.lastAt) - ms(a.lastAt));
    return { list, unread: list.filter((r) => r.unread).length };
  }, [rows, reads, me]);
}

// The conversation document itself: is there one, is it a request, who sent it, was it accepted.
export function useDmMeta(me, other) {
  const [meta, setMeta] = useState({ loading: true, exists: false });
  useEffect(() => {
    if (!me || !other) return undefined;
    setMeta({ loading: true, exists: false });
    return onSnapshot(
      doc(db, "dms", pairId(me, other)),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        setMeta({
          loading: false,
          exists: snap.exists(),
          request: d.request || "",
          viaCircle: d.viaCircle || "",
          accepted: d.accepted === true,
          declined: d.declined === true,
        });
      },
      () => setMeta({ loading: false, exists: false })
    );
  }, [me, other]);
  return meta;
}

// A circle you and this person are both in (its id), or "" if there is none.
// Message requests are only allowed between people who share a circle.
export async function sharedCircleWith(me, other) {
  if (!me || !other) return "";
  try {
    const mine = (await listMyCommunities(me)) || [];
    const hit = mine.find((c) => !c.deleted && Array.isArray(c.members) && c.members.includes(other));
    return hit?.id || "";
  } catch {
    return "";
  }
}

// Same thing as a hook. circleId is "" until it is known (loading=true) or when you share no circle.
export function useSharedCircle(me, other, enabled = true) {
  const [state, setState] = useState({ loading: true, circleId: "" });
  useEffect(() => {
    if (!enabled || !me || !other) {
      setState({ loading: false, circleId: "" });
      return undefined;
    }
    let cancelled = false;
    setState({ loading: true, circleId: "" });
    sharedCircleWith(me, other).then((id) => !cancelled && setState({ loading: false, circleId: id }));
    return () => {
      cancelled = true;
    };
  }, [me, other, enabled]);
  return state;
}

// The person who got a request says yes (they can now chat both ways) or no (it disappears for them).
export async function acceptDmRequest(me, other) {
  if (!me || !other) throw new Error("Missing person");
  await updateDoc(doc(db, "dms", pairId(me, other)), { accepted: true });
}
export async function declineDmRequest(me, other) {
  if (!me || !other) throw new Error("Missing person");
  await updateDoc(doc(db, "dms", pairId(me, other)), { declined: true });
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

// "Typing…". They write { uid, at } while they type and delete it when they stop or send.
// A leftover doc (phone closed mid-sentence) never shows: it is ignored when you open the chat and hides itself after a few seconds.
const TYPING_MS = 5000;
export function useDmTyping(me, other) {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    setTyping(false);
    if (!me || !other) return undefined;
    let timer = null;
    let first = true;
    let lastT = 0;
    const unsub = onSnapshot(
      doc(db, "dms", pairId(me, other), "typing", other),
      (snap) => {
        if (snap.metadata?.fromCache) return;
        const d = snap.exists() ? snap.data() : null;
        const t = ms(d?.at);
        if (t && t === lastT) return; // the same write again, nothing new
        lastT = t;
        clearTimeout(timer);
        let live = !!d && !!t;
        if (live && first) live = Math.abs(Date.now() - t) < TYPING_MS;
        first = false;
        setTyping(live);
        if (live) timer = setTimeout(() => setTyping(false), TYPING_MS);
      },
      () => setTyping(false)
    );
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [me, other]);
  return typing;
}

export function setDmTyping(me, other) {
  if (!me || !other) return Promise.resolve();
  return setDoc(doc(db, "dms", pairId(me, other), "typing", me), { uid: me, at: serverTimestamp() }).catch(() => {});
}

export function clearDmTyping(me, other) {
  if (!me || !other) return Promise.resolve();
  return deleteDoc(doc(db, "dms", pairId(me, other), "typing", me)).catch(() => {});
}

export async function markDmRead(me, other) {
  if (!me || !other) return;
  await setDoc(doc(db, "users", me, "dmReads", pairId(me, other)), { at: serverTimestamp() });
}

// viaCircle: pass the id of a circle you both are in ONLY when you are not friends. If there is no conversation yet,
// this sends a message request (one first message, text only). If a conversation already exists it is a normal send.
export async function sendDm(meInfo, other, { text = "", imageUrl = "", replyTo = null, viaCircle = "" }) {
  const body = String(text || "").trim().slice(0, 2000);
  if (!meInfo?.uid || !other || (!body && !imageUrl)) throw new Error("Nothing to send");
  const pid = pairId(meInfo.uid, other);
  let asRequest = false;
  if (viaCircle) {
    let exists = false;
    try {
      exists = (await getDoc(doc(db, "dms", pid))).exists();
    } catch {
      exists = false;
    }
    asRequest = !exists;
  }
  if (asRequest && imageUrl) throw new Error("A first message can only be text");
  const batch = writeBatch(db);
  // A quoted message is stored as a small snapshot so it still reads well if the original is deleted.
  const quote = replyTo?.id
    ? {
        id: String(replyTo.id).slice(0, 40),
        uid: String(replyTo.uid || "").slice(0, 64),
        displayName: String(replyTo.displayName || "").slice(0, 80),
        text: String(replyTo.text || "").slice(0, 140),
      }
    : null;
  batch.set(asRequest ? doc(db, "dms", pid, "messages", "request") : doc(collection(db, "dms", pid, "messages")), {
    uid: meInfo.uid,
    text: body,
    imageUrl: imageUrl || "",
    ...(quote ? { replyTo: quote } : {}),
    createdAt: serverTimestamp(),
  });
  batch.set(
    doc(db, "dms", pid),
    {
      users: [meInfo.uid, other].sort(),
      lastText: (body || "Photo").slice(0, 200),
      lastAt: serverTimestamp(),
      lastFrom: meInfo.uid,
      ...(asRequest ? { request: meInfo.uid, viaCircle: String(viaCircle).slice(0, 64) } : {}),
    },
    { merge: true }
  );
  await batch.commit();
  // A request stays quiet: no alert, it just shows up under Requests. Normal messages notify as before.
  if (!asRequest) {
    notifyDm({ to: other, from: meInfo, preview: body || "sent a photo" }); // bell entry (one per sender per 10 min)
    pushDm(other); // phone push for THIS message (the server checks everything)
  }
}

export async function deleteDm(me, other, messageId) {
  if (!me || !other || !messageId) return;
  await deleteDoc(doc(db, "dms", pairId(me, other), "messages", messageId));
}

// Change the text of your own message.
export async function editDm(me, other, messageId, text) {
  const body = String(text || "").trim().slice(0, 2000);
  if (!me || !other || !messageId || !body) throw new Error("Nothing to save");
  await updateDoc(doc(db, "dms", pairId(me, other), "messages", messageId), {
    text: body,
    edited: true,
    updatedAt: serverTimestamp(),
  });
}

// Add or remove your emoji reaction on a message (either person can react to any message).
export async function toggleDmReaction(me, other, messageId, emoji, alreadyReacted) {
  if (!me || !other || !messageId || !emoji) return;
  await updateDoc(doc(db, "dms", pairId(me, other), "messages", messageId), {
    [`reactions.${emoji}`]: alreadyReacted ? arrayRemove(me) : arrayUnion(me),
  });
}