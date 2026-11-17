// api/_push.js   (the underscore keeps Vercel from counting it as its own function)
//
// Called from api/daily-room.js whenever the request body has action "push:notify" or "push:session".
//
// Sends iPhone push notifications straight through Apple's push service (APNs).
//
// Two actions, both need a signed-in person (Firebase ID token in the
// Authorization header). The server never trusts text from the app:
//
//   { action: "push:notify",  to, id }       push for an in-app notification that already exists in
//                                       users/{to}/notifications/{id}. The caller must be the
//                                       person who created it (fromUid), and it only goes out once.
//   { action: "push:session", communityId }  a live session just started: write a notification for every
//                                       other member and push it. The caller must be a member.
//                                       At most one per circle every 30 minutes.
//
// Environment variables (Vercel):
//   APNS_KEY_ID      10-character Key ID of the APNs key
//   APNS_TEAM_ID     10-character Apple Team ID
//   APNS_KEY         contents of the AuthKey_XXXX.p8 file (plain, or base64 of it)
//   APNS_BUNDLE_ID   optional, defaults to com.snaprium.app
//   APNS_ENV         optional, "sandbox" only for Xcode debug builds. TestFlight and App Store = production.
//   FIREBASE_SERVICE_ACCOUNT (already used by your other api files)

import http2 from "node:http2";
import crypto from "node:crypto";
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const BUNDLE_ID = process.env.APNS_BUNDLE_ID || "com.snaprium.app";
const APNS_HOST =
  process.env.APNS_ENV === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";

const MAX_NOTIFY_AGE_MS = 10 * 60 * 1000;
const SESSION_COOLDOWN_MS = 30 * 60 * 1000;
const SESSION_MAX_MEMBERS = 200;
const EVERYONE_COOLDOWN_MS = 2 * 60 * 1000;
const EVERYONE_MAX_MEMBERS = 500;

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
  res.setHeader("Vary", "Origin");
}

// Same start-up as api/delete-account.js
function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      json = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    }
    if (json.private_key) json.private_key = json.private_key.replace(/\\n/g, "\n");
    return initializeApp({ credential: cert(json) });
  }

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }

  return initializeApp({ credential: applicationDefault() });
}

/* ------------------------------------------------------------------ */
/* APNs                                                                */
/* ------------------------------------------------------------------ */

const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

function readApnsKey() {
  let key = process.env.APNS_KEY || "";
  if (!key) return "";
  if (!key.includes("BEGIN")) {
    try {
      key = Buffer.from(key, "base64").toString("utf8");
    } catch {}
  }
  return key.replace(/\\n/g, "\n").trim();
}

let cachedJwt = { token: "", at: 0 };

// Apple wants a fresh token between 20 and 60 minutes old.
function apnsJwt() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt.token && now - cachedJwt.at < 40 * 60) return cachedJwt.token;

  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const pem = readApnsKey();
  if (!keyId || !teamId || !pem) throw new Error("APNs is not configured");

  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: now }));
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), {
    key: crypto.createPrivateKey(pem),
    dsaEncoding: "ieee-p1363",
  });
  cachedJwt = { token: `${header}.${claims}.${b64url(signature)}`, at: now };
  return cachedJwt.token;
}

// jobs: [{ token, payload, collapseId }]  ->  [{ token, status, reason }]
function sendApns(jobs) {
  return new Promise((resolve) => {
    if (!jobs.length) return resolve([]);

    let jwt;
    try {
      jwt = apnsJwt();
    } catch (err) {
      console.error("[push]", err.message);
      return resolve(jobs.map((j) => ({ token: j.token, status: 0, reason: "NotConfigured" })));
    }

    const results = [];
    let finished = false;
    const client = http2.connect(APNS_HOST);

    const done = () => {
      if (finished) return;
      finished = true;
      try {
        client.close();
      } catch {}
      resolve(results);
    };

    const guard = setTimeout(() => {
      jobs.forEach((j) => {
        if (!results.find((r) => r.token === j.token)) {
          results.push({ token: j.token, status: 0, reason: "Timeout" });
        }
      });
      done();
    }, 9000);

    client.on("error", (err) => {
      console.error("[push] connection", err.message);
      jobs.forEach((j) => {
        if (!results.find((r) => r.token === j.token)) {
          results.push({ token: j.token, status: 0, reason: "ConnectionError" });
        }
      });
      clearTimeout(guard);
      done();
    });

    let pending = jobs.length;
    const settle = () => {
      pending -= 1;
      if (pending <= 0) {
        clearTimeout(guard);
        done();
      }
    };

    jobs.forEach((job) => {
      const body = JSON.stringify(job.payload);
      const headers = {
        ":method": "POST",
        ":path": `/3/device/${job.token}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      };
      if (job.collapseId) headers["apns-collapse-id"] = String(job.collapseId).slice(0, 64);

      const req = client.request(headers);
      let status = 0;
      let text = "";
      req.setEncoding("utf8");
      req.on("response", (h) => {
        status = Number(h[":status"]) || 0;
      });
      req.on("data", (chunk) => {
        text += chunk;
      });
      req.on("end", () => {
        let reason = "";
        try {
          reason = text ? JSON.parse(text).reason || "" : "";
        } catch {}
        results.push({ token: job.token, status, reason });
        settle();
      });
      req.on("error", () => {
        results.push({ token: job.token, status: 0, reason: "RequestError" });
        settle();
      });
      req.end(body);
    });
  });
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function headline(n, communityName) {
  const who = n.fromName || "Someone";
  switch (n.type) {
    case "mention":
      return { title: `${who} mentioned you`, body: n.preview || `in ${communityName}` };
    case "reply":
      return { title: `${who} replied to you`, body: n.preview || `in ${communityName}` };
    case "answer":
      return { title: `${who} answered your question`, body: n.preview || `in ${communityName}` };
    case "spark":
      return { title: `${who} sparked your ${n.emoji === "question" ? "question" : "answer"}`, body: n.preview || `in ${communityName}` };
    case "reaction":
      return { title: `${who} reacted ${n.emoji || ""} to your message`.replace("  ", " "), body: n.preview || `in ${communityName}` };
    case "everyone":
      return { title: `${who} mentioned everyone in ${communityName}`, body: n.preview || "Tap to read" };
    case "session":
      return { title: `Live session in ${communityName}`, body: `${who} started a session. Tap to join.` };
    default:
      return { title: "Snaprium", body: n.preview || "You have a new notification" };
  }
}

async function unreadCount(db, uid) {
  try {
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .where("read", "==", false)
      .count()
      .get();
    return snap.data().count || 0;
  } catch {
    return 0;
  }
}

async function tokensFor(db, uids) {
  const out = new Map(); // uid -> [tokens]
  for (let i = 0; i < uids.length; i += 10) {
    const chunk = uids.slice(i, i + 10);
    const snap = await db.collection("pushTokens").where("uid", "in", chunk).get();
    snap.forEach((d) => {
      const uid = d.data().uid;
      if (!out.has(uid)) out.set(uid, []);
      out.get(uid).push(d.id);
    });
  }
  return out;
}

// Which of these people have blocked the sender? (users/{them}/blocked/{sender})
async function blockedBy(db, toUids, fromUid) {
  const out = new Set();
  const list = [...new Set(toUids)].filter(Boolean);
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const refs = chunk.map((t) => db.collection("users").doc(t).collection("blocked").doc(fromUid));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap, k) => {
      if (snap.exists) out.add(chunk[k]);
    });
  }
  return out;
}

async function deliver(db, notes) {
  // notes: [{ uid, id, data }]
  const uids = [...new Set(notes.map((n) => n.uid))];
  if (!uids.length) return { sent: 0, failed: 0 };

  const tokenMap = await tokensFor(db, uids);
  const badges = new Map();
  await Promise.all(
    uids
      .filter((u) => tokenMap.has(u))
      .map(async (u) => {
        badges.set(u, await unreadCount(db, u));
      })
  );

  const jobs = [];
  for (const n of notes) {
    const tokens = tokenMap.get(n.uid) || [];
    const { title, body } = headline(n.data, n.data.communityName || "your circle");
    for (const token of tokens) {
      jobs.push({
        token,
        collapseId: n.id,
        payload: {
          aps: {
            alert: { title, body },
            sound: "default",
            badge: badges.get(n.uid) || 1,
            "thread-id": n.data.communityId || "snaprium",
          },
          url: n.data.url || "/notifications",
          type: n.data.type || "",
        },
      });
    }
  }

  const results = await sendApns(jobs);
  let sent = 0;
  let failed = 0;
  let logged = 0;
  for (const r of results) {
    if (r.status === 200) {
      sent += 1;
      continue;
    }
    failed += 1;
    console.warn("[push] apns", r.status, r.reason);
    // Keep Apple's answer where you can read it: Firestore > pushLog (server only, apps cannot read it).
    if (logged < 5) {
      logged += 1;
      db.collection("pushLog")
        .add({ at: Timestamp.now(), status: r.status, reason: r.reason || "", tokenTail: String(r.token).slice(-8), host: APNS_HOST })
        .catch(() => {});
    }
    // Phone no longer has the app / token is dead: forget it.
    if (r.status === 410 || r.reason === "Unregistered") {
      db.collection("pushTokens").doc(r.token).delete().catch(() => {});
    }
  }
  return { sent, failed };
}

/* ------------------------------------------------------------------ */
/* handler                                                             */
/* ------------------------------------------------------------------ */

export async function handlePush(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const header = req.headers.authorization || "";
    const idToken = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!idToken) return res.status(401).json({ ok: false, error: "Sign in required" });

    const app = getAdminApp();
    let decoded;
    try {
      decoded = await getAuth(app).verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ ok: false, error: "Sign in required" });
    }
    const uid = decoded.uid;
    const db = getFirestore(app);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const safe = (v) => typeof v === "string" && v.length > 0 && v.length < 200 && !v.includes("/");

    /* ---------- an in-app notification that already exists ---------- */
    const action = String(body.action || "").replace(/^push:/, "");

    if (action === "notify") {
      if (!safe(body.to) || !safe(body.id)) return res.status(400).json({ ok: false, error: "Bad request" });

      // Someone who blocked you never gets an alert from you.
      if ((await blockedBy(db, [body.to], uid)).has(body.to)) {
        return res.status(200).json({ ok: true, skipped: "blocked" });
      }

      const ref = db.collection("users").doc(body.to).collection("notifications").doc(body.id);
      const claimed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        const data = snap.data();
        if (data.fromUid !== uid) return "forbidden";
        if (data.pushed) return "already";
        const at = data.createdAt?.toMillis?.() || 0;
        if (!at || Date.now() - at > MAX_NOTIFY_AGE_MS) return "stale";
        tx.update(ref, { pushed: true });
        return data;
      });

      if (claimed === null) return res.status(404).json({ ok: false, error: "Not found" });
      if (claimed === "forbidden") return res.status(403).json({ ok: false, error: "Not allowed" });
      if (typeof claimed === "string") return res.status(200).json({ ok: true, skipped: claimed });

      const out = await deliver(db, [{ uid: body.to, id: body.id, data: claimed }]);
      return res.status(200).json({ ok: true, ...out });
    }

    /* ---------- test alert to my own phone(s) ---------- */
    if (action === "test") {
      const configured = Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && readApnsKey());
      const tokenMap = await tokensFor(db, [uid]);
      const tokens = tokenMap.get(uid) || [];
      if (!configured) return res.status(200).json({ ok: false, configured, tokens: tokens.length, error: "Server is missing APNS_KEY_ID, APNS_TEAM_ID or APNS_KEY" });
      if (!tokens.length) return res.status(200).json({ ok: false, configured, tokens: 0, error: "No phone is registered for this account yet" });
      const results = await sendApns(
        tokens.map((token) => ({
          token,
          collapseId: "test",
          payload: { aps: { alert: { title: "Snaprium", body: "Push notifications are working." }, sound: "default" }, url: "/notifications", type: "test" },
        }))
      );
      for (const r of results) {
        if (r.status === 410 || r.reason === "Unregistered") db.collection("pushTokens").doc(r.token).delete().catch(() => {});
      }
      const sent = results.filter((r) => r.status === 200).length;
      return res.status(200).json({
        ok: sent > 0,
        configured,
        tokens: tokens.length,
        sent,
        error: sent > 0 ? "" : `Apple said: ${results[0]?.reason || results[0]?.status || "no answer"}`,
      });
    }

    /* ---------- live session started in a circle ---------- */
    if (action === "session") {
      if (!safe(body.communityId)) return res.status(400).json({ ok: false, error: "Bad request" });

      const cref = db.collection("communities").doc(body.communityId);
      const csnap = await cref.get();
      if (!csnap.exists) return res.status(404).json({ ok: false, error: "Not found" });
      const community = csnap.data();
      if (community.deleted === true) return res.status(404).json({ ok: false, error: "Not found" });

      const members = Array.isArray(community.members) ? community.members : [];
      if (!members.includes(uid)) return res.status(403).json({ ok: false, error: "Not allowed" });

      const last = community.lastSessionPushAt?.toMillis?.() || 0;
      if (Date.now() - last < SESSION_COOLDOWN_MS) return res.status(200).json({ ok: true, skipped: "cooldown" });
      await cref.update({ lastSessionPushAt: Timestamp.now() });

      const userSnap = await db.collection("users").doc(uid).get();
      const profile = userSnap.exists ? userSnap.data() : {};
      const fromName = String(profile.displayName || decoded.name || "Someone").slice(0, 60);
      const fromPhoto = String(profile.photoURL || "").slice(0, 390);
      const boardId = typeof body.boardId === "string" && safe(body.boardId) ? body.boardId : "";
      const url = `/community/${body.communityId}/chat${boardId ? `?board=${boardId}` : ""}`;
      const bucket = Math.floor(Date.now() / SESSION_COOLDOWN_MS);

      const candidates = members.filter((m) => m !== uid).slice(0, SESSION_MAX_MEMBERS);
      const blockers = await blockedBy(db, candidates, uid);
      const targets = candidates.filter((m) => !blockers.has(m));
      const notes = [];
      let batch = db.batch();
      let inBatch = 0;
      for (const to of targets) {
        const id = `session_${body.communityId}_${bucket}`;
        const data = {
          type: "session",
          fromUid: uid,
          fromName,
          fromPhoto,
          communityId: body.communityId,
          communityName: String(community.name || "Circle").slice(0, 60),
          boardId,
          targetId: "",
          preview: "",
          emoji: "",
          url,
          read: false,
          pushed: true,
          createdAt: FieldValue.serverTimestamp(),
        };
        batch.set(db.collection("users").doc(to).collection("notifications").doc(id), data);
        notes.push({ uid: to, id, data });
        inBatch += 1;
        if (inBatch >= 400) {
          await batch.commit();
          batch = db.batch();
          inBatch = 0;
        }
      }
      if (inBatch) await batch.commit();

      const out = await deliver(db, notes);
      return res.status(200).json({ ok: true, members: targets.length, ...out });
    }

    /* ---------- "@everyone": circle admins ping the whole circle ---------- */
    if (action === "everyone") {
      if (!safe(body.communityId) || !safe(body.messageId)) return res.status(400).json({ ok: false, error: "Bad request" });

      const cref = db.collection("communities").doc(body.communityId);
      const csnap = await cref.get();
      if (!csnap.exists) return res.status(404).json({ ok: false, error: "Not found" });
      const community = csnap.data();
      if (community.deleted === true) return res.status(404).json({ ok: false, error: "Not found" });

      const members = Array.isArray(community.members) ? community.members : [];
      const admins = Array.isArray(community.admins) ? community.admins : [];
      if (!members.includes(uid) || !(admins.includes(uid) || community.createdBy === uid)) {
        return res.status(403).json({ ok: false, error: "Not allowed" });
      }

      // The message must really exist, be the sender's, and mention everyone (stops forged pings).
      const boardId = typeof body.boardId === "string" && safe(body.boardId) ? body.boardId : "";
      const msgSnap = await cref.collection("messages").doc(body.messageId).get();
      const msg = msgSnap.exists ? msgSnap.data() : null;
      if (!msg || msg.uid !== uid || !/(^|\s)@(everyone|all)(?![\p{L}\p{N}_])/iu.test(String(msg.text || ""))) {
        return res.status(403).json({ ok: false, error: "Not allowed" });
      }

      const last = community.lastEveryoneAt?.toMillis?.() || 0;
      if (Date.now() - last < EVERYONE_COOLDOWN_MS) return res.status(200).json({ ok: true, skipped: "cooldown" });
      await cref.update({ lastEveryoneAt: Timestamp.now() });

      const userSnap = await db.collection("users").doc(uid).get();
      const profile = userSnap.exists ? userSnap.data() : {};
      const fromName = String(profile.displayName || decoded.name || "Someone").slice(0, 60);
      const fromPhoto = String(profile.photoURL || "").slice(0, 390);
      const url = `/community/${body.communityId}/chat?board=${boardId}&m=${body.messageId}`;
      const preview = String(msg.text || "").replace(/\s+/g, " ").trim().slice(0, 140);

      const candidates = members.filter((m) => m !== uid).slice(0, EVERYONE_MAX_MEMBERS);
      const blockers = await blockedBy(db, candidates, uid);
      const targets = candidates.filter((m) => !blockers.has(m));
      const notes = [];
      let batch = db.batch();
      let inBatch = 0;
      for (const to of targets) {
        const id = `everyone_${body.messageId}`;
        const data = {
          type: "everyone",
          fromUid: uid,
          fromName,
          fromPhoto,
          communityId: body.communityId,
          communityName: String(community.name || "Circle").slice(0, 60),
          boardId,
          targetId: body.messageId,
          preview,
          emoji: "",
          url,
          read: false,
          pushed: true,
          createdAt: FieldValue.serverTimestamp(),
        };
        batch.set(db.collection("users").doc(to).collection("notifications").doc(id), data);
        notes.push({ uid: to, id, data });
        inBatch += 1;
        if (inBatch >= 400) {
          await batch.commit();
          batch = db.batch();
          inBatch = 0;
        }
      }
      if (inBatch) await batch.commit();

      const out = await deliver(db, notes);
      return res.status(200).json({ ok: true, members: targets.length, ...out });
    }

    return res.status(400).json({ ok: false, error: "Unknown action" });
  } catch (err) {
    console.error("[push] failed", err);
    return res.status(500).json({ ok: false, error: "Could not send" });
  }
}