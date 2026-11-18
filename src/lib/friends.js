// src/lib/friends.js
//
// Friends. One document per pair of people:  friendships/{uidA_uidB}   (the two uids sorted A-Z)
//   { users: [uidA, uidB], requesterId, status: "pending" | "accepted", createdAt, updatedAt }
//
//  - useFriendship(me, other)  live status between you and one person (used by the profile card)
//  - useFriendships(me)        live lists: friends, requests sent to you, requests you sent
//  - sendFriendRequest / acceptFriendRequest / removeFriendship
//
// Rules (firestore.rules) make sure only the two people can see it, only the sender can create it,
// only the other person can accept it, and nobody can send a request to someone who blocked them.
// Declining, cancelling and unfriending are all the same thing: delete the document.

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { notifyFriend } from "./notifications";

export const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

// "none" | "friends" | "sent" (you asked them) | "received" (they asked you)
export function statusFrom(me, row) {
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requesterId === me ? "sent" : "received";
}

export function useFriendship(me, other) {
  const [state, setState] = useState({ loading: true, row: null });

  useEffect(() => {
    if (!me || !other || me === other) {
      setState({ loading: false, row: null });
      return undefined;
    }
    setState({ loading: true, row: null });
    return onSnapshot(
      doc(db, "friendships", pairId(me, other)),
      (snap) => setState({ loading: false, row: snap.exists() ? { id: snap.id, ...snap.data() } : null }),
      () => setState({ loading: false, row: null })
    );
  }, [me, other]);

  return { loading: state.loading, status: statusFrom(me, state.row), row: state.row };
}

export function useFriendships(me) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) {
      setRows([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return onSnapshot(
      query(collection(db, "friendships"), where("users", "array-contains", me)),
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => {
        setRows([]);
        setLoading(false);
      }
    );
  }, [me]);

  return useMemo(() => {
    const other = (r) => (r.users || []).find((u) => u !== me) || "";
    const friends = [];
    const incoming = [];
    const outgoing = [];
    for (const r of rows) {
      const uid = other(r);
      if (!uid) continue;
      if (r.status === "accepted") friends.push(uid);
      else if (r.requesterId === me) outgoing.push(uid);
      else incoming.push(uid);
    }
    return { loading, friends, incoming, outgoing };
  }, [rows, me, loading]);
}

export async function sendFriendRequest(me, otherUid) {
  if (!me?.uid || !otherUid || me.uid === otherUid) throw new Error("Cannot add");
  await setDoc(doc(db, "friendships", pairId(me.uid, otherUid)), {
    users: [me.uid, otherUid].sort(),
    requesterId: me.uid,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  notifyFriend({ to: otherUid, type: "friend_request", from: me });
}

export async function acceptFriendRequest(me, otherUid) {
  if (!me?.uid || !otherUid) throw new Error("Cannot accept");
  await updateDoc(doc(db, "friendships", pairId(me.uid, otherUid)), {
    status: "accepted",
    updatedAt: serverTimestamp(),
  });
  notifyFriend({ to: otherUid, type: "friend_accept", from: me });
}

// Decline a request, cancel one you sent, or remove a friend.
export async function removeFriendship(myUid, otherUid) {
  if (!myUid || !otherUid) return;
  await deleteDoc(doc(db, "friendships", pairId(myUid, otherUid)));
}