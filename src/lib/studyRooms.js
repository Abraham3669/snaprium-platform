// src/lib/studyRooms.js
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  query,
  where,
  orderBy,
  limit,
  addDoc,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Generate a short readable room code
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
      mode: "idle",
      duration: 25 * 60,
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
  if (!code || !user) {
    throw new Error("Missing code or user");
  }

  const cleanCode = code.trim().toUpperCase();

  const q = query(
    collection(db, "studyRooms"),
    where("code", "==", cleanCode)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error("Room not found. Check the code and try again.");
  }

  const roomDoc = snapshot.docs[0];
  const roomId = roomDoc.id;

  // Re-use the existing join logic
  return await joinStudyRoom(roomId, user);
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
 * Listen to room changes
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