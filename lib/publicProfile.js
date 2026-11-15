// src/lib/publicProfile.js
//
// One small public card per person: publicProfiles/{uid} = { displayName, photoURL, updatedAt }.
// Everyone who signs in can read it, only the owner can write it. Chat, questions and notifications
// read it, so a new name or photo shows up everywhere instead of the one saved inside each old message.
//
//  - publishPublicProfile(user)  keeps YOUR card current (App.jsx calls it whenever your profile changes)
//  - useLiveProfiles(uids)       gives { [uid]: { displayName, photoURL } } for the people on screen
//  - tinyPhoto(url)              what to store inside a message: a short link only, never a big picture

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const CARD_PHOTO_MAX = 20000; // characters. Bigger pictures are shrunk to a small avatar first.
const TTL_MS = 5 * 60 * 1000;
const MAX_UIDS = 60;
const cache = new Map(); // uid -> { name, photo, at }

// Short links only (a Google picture URL, say). A pasted-in photo is far too big to copy into every message.
export const tinyPhoto = (url) => (typeof url === "string" && url.length <= 400 ? url : "");

function shrink(dataUrl, max = 128, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// "" = the person has no photo. null = could not work it out (then the old card photo is left alone).
async function avatarFor(url) {
  if (!url) return "";
  if (url.startsWith("data:")) return url.length <= CARD_PHOTO_MAX ? url : shrink(url);
  return url.length <= 1000 ? url : null;
}

export async function publishPublicProfile(user) {
  // profileLoaded is false while the app only has Google's name and picture (before your own profile
  // has loaded). Publishing then would put Google's picture back over the one you chose.
  if (!user?.uid || user.profileLoaded !== true) return;
  const name = String(user.displayName || "").trim().slice(0, 80);
  if (!name) return;
  const photo = await avatarFor(user.photoURL || "");
  const data = { displayName: name, updatedAt: serverTimestamp() };
  if (photo !== null) data.photoURL = photo;
  await setDoc(doc(db, "publicProfiles", user.uid), data, { merge: true });
  cache.set(user.uid, { name, photo: photo === null ? cache.get(user.uid)?.photo || "" : photo, at: Date.now() });
}

const fromCache = (uids) => {
  const out = {};
  for (const uid of uids) {
    const c = cache.get(uid);
    if (c) out[uid] = { displayName: c.name, photoURL: c.photo };
  }
  return out;
};

export function useLiveProfiles(uids) {
  const key = useMemo(
    () => [...new Set((uids || []).filter(Boolean))].sort().slice(0, MAX_UIDS).join(","),
    [uids]
  );
  const [map, setMap] = useState(() => fromCache(key ? key.split(",") : []));

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (!list.length) return undefined;
    let cancelled = false;
    setMap(fromCache(list));
    const stale = list.filter((uid) => {
      const c = cache.get(uid);
      return !c || Date.now() - c.at > TTL_MS;
    });
    if (!stale.length) return undefined;
    (async () => {
      await Promise.all(
        stale.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "publicProfiles", uid));
            const d = snap.exists() ? snap.data() : {};
            cache.set(uid, { name: d.displayName || "", photo: d.photoURL || "", at: Date.now() });
          } catch {}
        })
      );
      if (!cancelled) setMap(fromCache(list));
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return map;
}