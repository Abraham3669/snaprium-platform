// src/lib/publicProfile.js
//
// One small public card per person: publicProfiles/{uid} = { displayName, photoURL, bio, banner, updatedAt }.
// Everyone who signs in can read it, only the owner can write it. Chat, questions and notifications
// read it, so a new name or photo shows up everywhere instead of the one saved inside each old message.
//
//  - publishPublicProfile(user)  keeps YOUR card current (App.jsx calls it whenever your profile changes)
//  - useLiveProfiles(uids)       gives { [uid]: { displayName, photoURL } } for the people on screen
//  - tinyPhoto(url)              what to store inside a message: a short link only, never a big picture
//  - fetchProfileCard(uid)       the full card (name, photo, bio, banner), always fresh. Used by the profile card.
//  - saveProfileExtras(user, x)  saves YOUR bio and/or banner (and name) on your card
//  - compressBanner(file)        turns a picture into a small 3:1 banner (JPEG data URL)

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

export const BIO_MAX = 160;
export const BANNER_MAX_CHARS = 90000;

// Centre-crops any picture to a 3:1 banner and shrinks it, so it always stays small (about 20-40 KB).
export function compressBanner(file, width = 720, height = 240, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const scale = Math.max(width / img.width, height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          canvas.getContext("2d").drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
          let out = canvas.toDataURL("image/jpeg", quality);
          if (out.length > BANNER_MAX_CHARS) out = canvas.toDataURL("image/jpeg", 0.5);
          resolve(out);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// The whole public card for one person, read fresh (not from the short-lived cache).
export async function fetchProfileCard(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "publicProfiles", uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      displayName: d.displayName || "",
      photoURL: d.photoURL || "",
      bio: d.bio || "",
      banner: d.banner || "",
    };
  } catch {
    return null;
  }
}

// Save your own bio and/or banner. `extra` can hold { bio, banner }. Name and photo are sent along so
// the card is always complete, even the first time it is written.
export async function saveProfileExtras(user, extra = {}) {
  if (!user?.uid) throw new Error("Sign in required");
  const data = { updatedAt: serverTimestamp() };
  const name = String(user.displayName || "").trim().slice(0, 80);
  if (name) data.displayName = name;
  const photo = await avatarFor(user.photoURL || "");
  if (photo !== null) data.photoURL = photo;
  if (typeof extra.bio === "string") data.bio = extra.bio.replace(/\s+/g, " ").trim().slice(0, BIO_MAX);
  if (typeof extra.banner === "string") data.banner = extra.banner;
  if (extra.displayName) data.displayName = String(extra.displayName).trim().slice(0, 80);
  await setDoc(doc(db, "publicProfiles", user.uid), data, { merge: true });
  const old = cache.get(user.uid);
  cache.set(user.uid, {
    name: data.displayName || old?.name || "",
    photo: data.photoURL ?? old?.photo ?? "",
    at: Date.now(),
  });
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