// src/lib/studyRooms.js
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Generate a short readable room code (e.g. "CALC-7X9K")
 */
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a new study room
 */
export async function createStudyRoom({ topic, createdBy, displayName }) {
  const code = generateRoomCode();
  const roomRef = doc(collection(db, "studyRooms"));

  const roomData = {
    id: roomRef.id,
    code,
    topic: topic || "General Study",
    createdBy,
    createdByName: displayName || "Student",
    createdAt: serverTimestamp(),
    participants: [
      {
        uid: createdBy,
        displayName: displayName || "Student",
        joinedAt: new Date().toISOString(),
        isOnline: true,
      },
    ],
    timer: {
      mode: "idle", // idle | running | paused
      duration: 25 * 60, // 25 minutes default
      remaining: 25 * 60,
      startedAt: null,
      updatedAt: serverTimestamp(),
    },
    lastActivity: serverTimestamp(),
  };

  await setDoc(roomRef, roomData);
  return { id: roomRef.id, code, ...roomData };
}

/**
 * Join a room by code
 */
export async function joinStudyRoomByCode(code, user) {
  // Find room by code (simple approach for V1)
  // In production we can add a code → roomId index
  const roomsRef = collection(db, "studyRooms");
  // For V1 we will pass roomId via link, but also support code
  // We'll improve this later. For now return null and handle in UI.
  return null; // temporary – we will use roomId primarily
}

/**
 * Join room by ID
 */
export async function joinStudyRoom(roomId, user) {
  const roomRef = doc(db, "studyRooms", roomId);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) {
    throw new Error("Room not found");
  }

  const data = snap.data();
  const alreadyIn = data.participants?.some((p) => p.uid === user.uid);

  if (!alreadyIn) {
    await updateDoc(roomRef, {
      participants: arrayUnion({
        uid: user.uid,
        displayName: user.displayName || user.email?.split("@")[0] || "Student",
        joinedAt: new Date().toISOString(),
        isOnline: true,
      }),
      lastActivity: serverTimestamp(),
    });
  } else {
    // Mark as online
    const updatedParticipants = data.participants.map((p) =>
      p.uid === user.uid ? { ...p, isOnline: true } : p
    );
    await updateDoc(roomRef, {
      participants: updatedParticipants,
      lastActivity: serverTimestamp(),
    });
  }

  return { id: roomId, ...data };
}

/**
 * Leave room / set offline
 */
export async function leaveStudyRoom(roomId, uid) {
  const roomRef = doc(db, "studyRooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const updated = (data.participants || []).map((p) =>
    p.uid === uid ? { ...p, isOnline: false } : p
  );

  await updateDoc(roomRef, {
    participants: updated,
    lastActivity: serverTimestamp(),
  });
}

/**
 * Listen to room changes (presence + timer)
 */
export function subscribeToRoom(roomId, callback) {
  const roomRef = doc(db, "studyRooms", roomId);
  return onSnapshot(roomRef, (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    } else {
      callback(null);
    }
  });
}

/**
 * Send a chat message
 */
export async function sendMessage(roomId, message) {
  const messagesRef = collection(db, "studyRooms", roomId, "messages");
  await addDoc(messagesRef, {
    ...message,
    createdAt: serverTimestamp(),
  });
}

/**
 * Listen to chat messages
 */
export function subscribeToMessages(roomId, callback) {
  const q = query(
    collection(db, "studyRooms", roomId, "messages"),
    orderBy("createdAt", "asc"),
    limit(100)
  );

  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(messages);
  });
}

/**
 * Update the shared timer
 */
export async function updateTimer(roomId, timerData) {
  const roomRef = doc(db, "studyRooms", roomId);
  await updateDoc(roomRef, {
    timer: {
      ...timerData,
      updatedAt: serverTimestamp(),
    },
    lastActivity: serverTimestamp(),
  });
}