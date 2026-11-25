// src/lib/video.js
//
// Short videos in posts. Everything about video lives here so the rest of the app only has to ask three things:
//   prepareVideo(file)        checks the clip, makes its cover picture, shortens/shrinks it when needed
//   uploadVideo(clip, uid)    puts it in Firebase Storage and resolves the media item saved with the post
//   deleteVideoFiles(media)   removes the file again (when a post is deleted or posting failed)
//
// A video in a post is one item of the post's `media` list:
//   { type: "video", url, path, poster, w, h, dur, mime }
//   url = the playable address, path = where the file lives in Storage, poster = small cover picture (stored in the
//   post itself so the feed shows something instantly), w/h = size, dur = seconds.
//
// HOW A CLIP IS HANDLED
//   - A short normal clip (mp4 or mov, up to 10 seconds, not huge) is uploaded exactly as it is.
//   - Anything longer, bigger or in an unusual format is re-recorded in the browser: cut to the first 10 seconds,
//     scaled down to at most 1280 pixels and encoded small (about 2 MB for 10 seconds). It plays in real time,
//     so a 10-second clip takes about 10 seconds to prepare.
//   - If this browser cannot re-record, the original is used only when it already fits the limits. Otherwise the
//     person gets a clear message. Nobody is ever told to "get the app" instead.
//
// THE SWITCH: leave VIDEO_ENABLED = false until you have tested one upload on your iPhone and one on a computer.
// While it is false the Video button is hidden. Videos that are already in posts still play either way.

import { getApp } from "firebase/app";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

export const VIDEO_ENABLED = false;

export const VIDEO = {
  seconds: 10, // longest clip
  maxInputBytes: 300 * 1024 * 1024, // biggest file we will even open
  keepBytes: 6 * 1024 * 1024, // short mp4/mov clips up to this size are uploaded untouched
  maxBytes: 25 * 1024 * 1024, // never upload more than this
  maxSide: 1280, // longest side in pixels after shrinking
  videoBitrate: 1800000, // bits per second when re-recording
  audioBitrate: 64000,
  keepAudio: true, // try to keep the sound when re-recording (best effort, see prepareVideo)
  posterSide: 480,
  posterChars: 60000, // cover picture size limit inside the post
  folder: "postVideos",
};

const UNSUPPORTED = "This video can't be opened in this browser. Try another clip, or a standard mp4.";
const OK_TYPES = /^video\/(mp4|quicktime|webm|x-m4v)$/;
const PLAIN_TYPES = /^video\/(mp4|quicktime|x-m4v|webm)$/;

const fileMime = (file) => {
  const t = String(file?.type || "").toLowerCase();
  if (t) return t === "video/x-m4v" ? "video/mp4" : t;
  const n = String(file?.name || "").toLowerCase(); // some phones give no type
  if (n.endsWith(".mp4") || n.endsWith(".m4v")) return "video/mp4";
  if (n.endsWith(".mov")) return "video/quicktime";
  if (n.endsWith(".webm")) return "video/webm";
  return "";
};
const baseMime = (m) => String(m || "").split(";")[0].trim().toLowerCase();
const extFor = (m) => (/webm/.test(m) ? "webm" : /quicktime/.test(m) ? "mov" : "mp4");
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

/* ---------------------------------------------------------------- reading a clip */

function openVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    const timer = setTimeout(() => reject(new Error(UNSUPPORTED)), 20000);
    v.onloadeddata = () => {
      clearTimeout(timer);
      resolve(v);
    };
    v.onerror = () => {
      clearTimeout(timer);
      reject(new Error(UNSUPPORTED));
    };
    v.src = url;
    v.load();
  });
}

const seek = (v, t) =>
  new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      v.removeEventListener("seeked", finish);
      resolve();
    };
    v.addEventListener("seeked", finish);
    setTimeout(finish, 4000);
    try {
      v.currentTime = t;
    } catch {
      finish();
    }
  });

// Some recorded files report an unknown (infinite) length until you seek to the end.
async function realDuration(v) {
  if (Number.isFinite(v.duration) && v.duration > 0) return v.duration;
  await seek(v, 1e7);
  const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : v.currentTime;
  await seek(v, 0);
  return d || 0;
}

async function makePoster(v, W, H, duration) {
  await seek(v, Math.min(0.3, duration / 4));
  let side = VIDEO.posterSide;
  for (let i = 0; i < 4; i++) {
    const scale = Math.min(1, side / Math.max(W, H));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(W * scale));
    canvas.height = Math.max(1, Math.round(H * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    for (let q = 0.72; q >= 0.4; q -= 0.12) {
      const url = canvas.toDataURL("image/jpeg", q);
      if (url.length <= VIDEO.posterChars) return url;
    }
    side = Math.round(side * 0.75);
  }
  throw new Error("Could not make a cover picture for this video");
}

/* ---------------------------------------------------------------- re-recording */

function pickMime() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  const list = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const m of list) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {}
  }
  return "";
}

// Plays the clip into a canvas and records it: first `seconds` only, scaled down, small bitrate.
function rerecord(v, W, H, seconds, mime, onProgress) {
  return new Promise((resolve, reject) => {
    const scale = Math.min(1, VIDEO.maxSide / Math.max(W, H));
    const w = even(W * scale);
    const h = even(H * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    if (!canvas.captureStream) return reject(new Error("no capture"));
    const ctx = canvas.getContext("2d", { alpha: false });
    const stream = canvas.captureStream(30);

    // Sound: only possible where the browser can capture it from the clip (computers and Android). On iPhone
    // Safari the re-recorded copy is silent, clips that are already small and short are uploaded untouched with sound.
    let hasAudio = false;
    if (VIDEO.keepAudio) {
      try {
        const cap = v.captureStream ? v.captureStream() : v.mozCaptureStream ? v.mozCaptureStream() : null;
        if (cap) {
          cap.getAudioTracks().forEach((t) => {
            stream.addTrack(t);
            hasAudio = true;
          });
        }
      } catch {}
    }

    let rec;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO.videoBitrate, audioBitsPerSecond: VIDEO.audioBitrate });
    } catch (e) {
      return reject(e);
    }
    const chunks = [];
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    rec.onerror = (e) => reject(e?.error || new Error("recording failed"));
    let finished = false;
    let timedOut = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(guard);
      cancelAnimationFrame(raf);
      v.pause();
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {}
    };
    rec.onstop = () => {
      if (timedOut) return reject(new Error("timed out"));
      const blob = new Blob(chunks, { type: baseMime(rec.mimeType || mime) });
      blob.size ? resolve({ blob, mime: blob.type || baseMime(mime), w, h, dur: seconds, audio: hasAudio }) : reject(new Error("empty recording"));
    };

    const startedAt = Date.now();
    const guard = setInterval(() => {
      // Never hang: if the clip does not move on (for example the tab was hidden), give up and let the caller fall back.
      if (Date.now() - startedAt > (seconds + 8) * 1000) {
        timedOut = true;
        finish();
      }
    }, 500);

    let raf = 0;
    const tick = () => {
      if (finished) return;
      try {
        ctx.drawImage(v, 0, 0, w, h);
      } catch {}
      onProgress?.(Math.min(1, v.currentTime / seconds));
      if (v.ended || v.currentTime >= seconds - 0.05) return finish();
      raf = requestAnimationFrame(tick);
    };

    seek(v, 0).then(() => {
      v.muted = !hasAudio;
      v.play().then(
        () => {
          rec.start(250);
          tick();
        },
        () => {
          // Sound may not start without a tap; then record it silently.
          v.muted = true;
          v.play().then(
            () => {
              rec.start(250);
              tick();
            },
            (e) => reject(e)
          );
        }
      );
    });
  });
}

/* ---------------------------------------------------------------- public: prepare, upload, delete */

/**
 * Checks and prepares a clip. Resolves { blob, mime, w, h, dur, poster, reencoded, silent }.
 * Throws an Error whose message can be shown to the person as it is.
 */
export async function prepareVideo(file, { onProgress } = {}) {
  if (!file) throw new Error("No video chosen");
  const type = fileMime(file);
  if (!OK_TYPES.test(type)) throw new Error("Choose an mp4, mov or webm video");
  if (file.size > VIDEO.maxInputBytes) throw new Error("That video is too large. Please choose one under 300 MB.");

  const url = URL.createObjectURL(file);
  try {
    const v = await openVideo(url);
    const W = v.videoWidth;
    const H = v.videoHeight;
    if (!W || !H) throw new Error(UNSUPPORTED);
    const duration = await realDuration(v);
    if (!duration) throw new Error(UNSUPPORTED);
    const poster = await makePoster(v, W, H, duration);

    const long = duration > VIDEO.seconds + 0.3;
    const big = Math.max(W, H) > VIDEO.maxSide;
    const heavy = file.size > VIDEO.keepBytes;
    const original = { blob: file, mime: type, w: W, h: H, dur: Math.round(duration * 10) / 10, poster, reencoded: false, silent: false };

    if (!long && !big && !heavy && PLAIN_TYPES.test(type)) return original;

    const mime = pickMime();
    if (mime) {
      try {
        const seconds = Math.min(duration, VIDEO.seconds);
        const out = await rerecord(v, W, H, seconds, mime, onProgress);
        // re-encoding must never make a clip bigger than the file we started with
        if (!long && out.blob.size >= file.size && file.size <= VIDEO.maxBytes && PLAIN_TYPES.test(type)) return original;
        if (out.blob.size <= VIDEO.maxBytes) {
          return { blob: out.blob, mime: out.mime, w: out.w, h: out.h, dur: Math.round(seconds * 10) / 10, poster, reencoded: true, silent: !out.audio };
        }
      } catch (e) {
        console.warn("[video] could not re-record, trying the original", e?.message || e);
      }
    }
    if (!long && file.size <= VIDEO.maxBytes && PLAIN_TYPES.test(type)) return original;
    throw new Error(
      long
        ? `Videos can be up to ${VIDEO.seconds} seconds. This browser can't shorten it, so please trim it first.`
        : "This video is too large and this browser can't shrink it. Try a shorter clip."
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Uploads a prepared clip. Resolves the media item to save in the post. */
export async function uploadVideo(clip, uid, { onProgress } = {}) {
  if (!uid) throw new Error("Sign in first");
  const mime = baseMime(clip.mime) || "video/mp4";
  const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${extFor(mime)}`;
  const path = `${VIDEO.folder}/${uid}/${name}`;
  const r = ref(getStorage(getApp()), path);
  const task = uploadBytesResumable(r, clip.blob, { contentType: mime, cacheControl: "public,max-age=31536000" });
  await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
      reject,
      resolve
    );
  });
  const url = await getDownloadURL(r);
  return { type: "video", url, path, poster: clip.poster, w: clip.w, h: clip.h, dur: clip.dur, mime };
}

/** Removes the stored file(s) of a post. Never throws (the post itself is already handled). */
export async function deleteVideoFiles(media) {
  const items = (Array.isArray(media) ? media : []).filter((m) => m && m.type === "video" && typeof m.path === "string" && m.path.startsWith(`${VIDEO.folder}/`));
  if (!items.length) return;
  const storage = getStorage(getApp());
  await Promise.all(
    items.map((m) =>
      deleteObject(ref(storage, m.path)).catch((e) => console.warn("[video] could not delete the file", e?.code || e?.message || e))
    )
  );
}

export const formatDuration = (s) => {
  const n = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};