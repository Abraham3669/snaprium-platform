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
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export async function deleteMessage(roomId, messageId) {
  await deleteDoc(doc(db, "studyRooms", roomId, "messages", messageId));
}

export async function rememberJoinedRoom(uid, room) {
  if (!uid || !room?.id) return;
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    joinedStudyRooms: arrayUnion({
      id: room.id,
      topic: room.topic || "Study Room",
      code: room.code || "",
    }),
  });
}

export async function hideRoomForMe(uid, roomId) {
  if (!uid || !roomId) return;
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    hiddenStudyRooms: arrayUnion(roomId),
  });
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

  try {
    await rememberJoinedRoom(createdBy, { id: roomRef.id, code, topic: roomData.topic });
  } catch (err) {
    console.warn("[studyRooms] rememberJoinedRoom create", err);
  }

  return { id: roomRef.id, code, ...roomData };
}

export async function joinStudyRoomByCode(code, user) {
  if (!code || !user) {
    throw new Error("Missing code or user");
  }

  const cleanCode = code.trim().toUpperCase();
  const q = query(collection(db, "studyRooms"), where("code", "==", cleanCode));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error("Room not found. Check the code and try again.");
  }

  return await joinStudyRoom(snapshot.docs[0].id, user);
}

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
    const updatedParticipants = data.participants.map((p) =>
      p.uid === user.uid ? { ...p, isOnline: true } : p
    );
    await updateDoc(roomRef, {
      participants: updatedParticipants,
      lastActivity: serverTimestamp(),
    });
  }

  try {
    await rememberJoinedRoom(user.uid, {
      id: roomId,
      topic: data.topic,
      code: data.code,
    });
  } catch (err) {
    console.warn("[studyRooms] rememberJoinedRoom join", err);
  }

  return { id: roomId, ...data };
}

export async function leaveStudyRoom(roomId, uid) {
  const roomRef = doc(db, "studyRooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;

  const updated = (snap.data().participants || []).map((p) =>
    p.uid === uid ? { ...p, isOnline: false } : p
  );

  await updateDoc(roomRef, {
    participants: updated,
    lastActivity: serverTimestamp(),
  });
}

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

export async function sendMessage(roomId, message) {
  const messagesRef = collection(db, "studyRooms", roomId, "messages");
  await addDoc(messagesRef, {
    ...message,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToMessages(roomId, callback) {
  const q = query(
    collection(db, "studyRooms", roomId, "messages"),
    orderBy("createdAt", "asc"),
    limit(100)
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

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