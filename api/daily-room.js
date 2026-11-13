// api/daily-room.js
//
// Safe live sessions:
//  - the caller must be signed in (Firebase ID token is verified here)
//  - for circle sessions the caller must be a member of that circle and not banned
//  - the Daily room is PRIVATE, so nobody can join with just the URL; each person gets a personal token
//  - the person who OPENS the room is the host. The host's plan sets the size and length for everyone
//  - Daily itself enforces max_participants and ends the room at its expiry time

import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const DAILY = "https://api.daily.co/v1";

// Change these numbers to change the limits.
const LIMITS = {
  free: { max: 5, minutes: 45, perDay: 2 }, // perDay = sessions a free person can OPEN per day
  paid: { max: 10, minutes: 180, perDay: null },
};

const PAID_PLANS = ["unlimited", "premium"];
const todayKey = () => new Date().toISOString().split("T")[0];

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept"
  );
  res.setHeader("Vary", "Origin");
}

// Starts firebase-admin once. Reads the key the same ways most Vercel setups store it.
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

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
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

const daily = (path, options = {}) =>
  fetch(`${DAILY}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

// Expected problems (full, not a member, daily limit...) come back as 200 with ok:false and a code,
// so the app can show a clear message instead of a generic network error.
const refuse = (res, code, error) => res.status(200).json({ ok: false, code, error });

export default async function handler(req, res) {
  try {
    setCors(req, res);

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true,
        message: "daily-room API is live. Use POST to start a call.",
      });
    }

    const body = req.body || {};
    const roomId = body.roomId;
    const userName = String(body.userName || "Student").slice(0, 40);

    if (!roomId) {
      return res.status(400).json({ error: "Missing roomId" });
    }

    if (!process.env.DAILY_API_KEY) {
      return res.status(500).json({ error: "Missing DAILY_API_KEY on Vercel" });
    }

    // 1. Who is this? (verified by Firebase, not trusted from the browser)
    const authHeader = String(req.headers.authorization || "");
    const idToken =
      body.idToken || (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "");
    if (!idToken) {
      return res.status(401).json({ error: "Please sign in to join a session." });
    }

    const app = getAdminApp();
    let uid;
    try {
      uid = (await getAuth(app).verifyIdToken(idToken)).uid;
    } catch {
      return res.status(401).json({ error: "Please sign in again to join a session." });
    }

    const db = getFirestore(app);

    // 2. Banned? Which plan?
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};
    if (userData.banned === true) {
      return refuse(res, "banned", "This account is suspended.");
    }
    const myTier = PAID_PLANS.includes(userData.plan) ? "paid" : "free";

    // 3. Circle sessions: only members of that circle may join
    const circle = /^community-([A-Za-z0-9_-]+)-session$/.exec(String(roomId));
    if (circle) {
      const cSnap = await db.doc(`communities/${circle[1]}`).get();
      if (!cSnap.exists || cSnap.data().deleted) {
        return refuse(res, "not_found", "This circle is no longer available.");
      }
      if (!(cSnap.data().members || []).includes(uid)) {
        return refuse(res, "not_member", "Join this circle to take part in its sessions.");
      }
    }

    const name = `snaprium-${String(roomId).slice(0, 40)}`;
    const nowSec = () => Math.floor(Date.now() / 1000);

    // 4. Is there already a live room? Then we join it, and its limits stay as the host set them.
    const loadRoom = async () => {
      const r = await daily(`/rooms/${name}`);
      if (r.status === 404) return null;
      const data = await r.json();
      return data?.url ? data : null;
    };

    let room = await loadRoom();

    const isUsable = (r) => {
      const c = r?.config || {};
      return r?.privacy === "private" && !!c.max_participants && c.exp > nowSec();
    };

    // Who is in the room right now? null = Daily didn't tell us (never block anyone because of that).
    const getPresence = async () => {
      try {
        const pr = await daily(`/rooms/${name}/presence`);
        if (!pr.ok) return null;
        const p = await pr.json();
        return {
          count: p.total_count || 0,
          ids: (p.data || []).map((x) => x.userId || x.user_id).filter(Boolean),
        };
      } catch {
        return null;
      }
    };

    // Read-only check for the "Live now" banner. It never creates, changes or counts anything.
    if (body.action === "status") {
      if (!room || !isUsable(room)) return res.status(200).json({ ok: true, live: false });
      const presence = await getPresence();
      const max = room.config.max_participants;
      const tier = max >= LIMITS.paid.max ? "paid" : "free";
      return res.status(200).json({
        ok: true,
        live: !!presence && presence.count > 0,
        count: presence ? presence.count : null,
        max,
        tier,
        minutes: LIMITS[tier].minutes,
        expiresAt: room.config.exp,
      });
    }

    // Rooms made by the old version of this file were public and had no size limit. Replace them.
    if (room && !isUsable(room)) {
      await daily(`/rooms/${name}`, { method: "DELETE" }).catch(() => {});
      room = null;
    }

    // An empty leftover room keeps the old host's clock. Once it has been empty (and older than
    // 2 minutes, so a room that is just being opened is never touched) the next person starts fresh.
    let presence = null;
    if (room) {
      presence = await getPresence();
      const ageSec = room.created_at ? (Date.now() - Date.parse(room.created_at)) / 1000 : 0;
      if (presence && presence.count === 0 && ageSec > 120) {
        await daily(`/rooms/${name}`, { method: "DELETE" }).catch(() => {});
        room = null;
        presence = null;
      }
    }

    // 5. No room yet: this person becomes the host and their plan sets the limits.
    if (!room) {
      const limit = LIMITS[myTier];
      const today = todayKey();
      const used = userData.lastLiveSessionDate === today ? userData.dailyLiveSessions || 0 : 0;

      if (limit.perDay && used >= limit.perDay) {
        return refuse(
          res,
          "daily_limit",
          `Free accounts can start ${limit.perDay} sessions a day. You can still join sessions that others start.`
        );
      }

      const exp = nowSec() + limit.minutes * 60;
      const createRes = await daily("/rooms", {
        method: "POST",
        body: JSON.stringify({
          name,
          privacy: "private",
          properties: {
            max_participants: limit.max,
            exp,
            eject_at_room_exp: true,
            start_video_off: true,
            start_audio_off: true,
            enable_screenshare: true,
            enable_chat: false,
          },
        }),
      });
      let data = await createRes.json();

      if (
        createRes.status === 400 &&
        String(data?.info || data?.error || "").toLowerCase().includes("already")
      ) {
        // Two people pressed Session at the same moment. The other one is the host.
        data = await loadRoom();
      } else if (data?.url && limit.perDay) {
        await userRef.set(
          {
            dailyLiveSessions: used + 1,
            lastLiveSessionDate: today,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      room = data?.url ? data : null;
    }

    if (!room?.url) {
      console.error("[daily-room] could not get a room");
      return res.status(500).json({ error: "Could not create study call" });
    }

    const cfg = room.config || {};
    const max = cfg.max_participants || LIMITS.free.max;
    const roomExp = cfg.exp || nowSec() + LIMITS.free.minutes * 60;
    const roomTier = max >= LIMITS.paid.max ? "paid" : "free";

    // 6. Full? (Daily also blocks this on its side; this just gives a clear message.)
    if (presence && !presence.ids.includes(uid) && presence.count >= max) {
      return refuse(
        res,
        "full",
        `This session is full (${max} people). Try again when someone leaves.`
      );
    }

    // 7. A personal entry pass that stops working when the room ends
    const tokenRes = await daily("/meeting-tokens", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          room_name: name,
          user_name: userName,
          user_id: uid,
          exp: roomExp,
          is_owner: false,
        },
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData?.token) {
      console.error("[daily-room] token failed", tokenData);
      return res.status(500).json({ error: "Could not create study call" });
    }

    return res.status(200).json({
      ok: true,
      url: room.url,
      token: tokenData.token,
      name,
      userName,
      max,
      tier: roomTier,
      minutes: LIMITS[roomTier].minutes,
      expiresAt: roomExp,
    });
  } catch (err) {
    console.error("[daily-room] crash", err);
    return res.status(500).json({
      error: "daily-room crashed",
      details: err.message || "Unknown error",
    });
  }
}