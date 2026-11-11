// api/delete-account.js
//
// Lets a signed-in person delete their own account (App Store rule 5.1.1(v)).
// The caller is identified ONLY by their verified Firebase ID token, so nobody can delete someone else.
//
// What it does, in this order:
//  1. deletes the Firebase sign-in account first (so the app can't quietly recreate the profile)
//  2. takes the person out of every circle (hands the circle to someone else, or removes it if empty)
//  3. deletes their chat messages, questions, replies, analytics events and profile document
// Step 3 is best effort: if one part fails it is logged and the rest still runs.

import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept"
  );
  res.setHeader("Vary", "Origin");
}

// Same start-up as api/daily-room.js
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

// delete every document a query returns (and anything under them), in pages
async function deleteWhere(db, makeQuery) {
  for (let i = 0; i < 50; i += 1) {
    const snap = await makeQuery().limit(200).get();
    if (snap.empty) return;
    await Promise.all(snap.docs.map((d) => db.recursiveDelete(d.ref)));
    if (snap.size < 200) return;
  }
}

export default async function handler(req, res) {
  try {
    setCors(req, res);

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const authHeader = String(req.headers.authorization || "");
    const idToken =
      (req.body && req.body.idToken) ||
      (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "");
    if (!idToken) return res.status(401).json({ error: "Please sign in again." });

    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    let uid;
    try {
      uid = (await auth.verifyIdToken(idToken)).uid;
    } catch {
      return res.status(401).json({ error: "Please sign in again." });
    }

    // A suspended account can't be deleted here, otherwise a ban could be dodged by starting over.
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (userSnap.exists && userSnap.data().banned === true) {
      return res.status(200).json({
        ok: false,
        code: "banned",
        error: "This account is suspended. Email support@snaprium.com to have it deleted.",
      });
    }

    const warnings = [];
    const attempt = async (label, fn) => {
      try {
        await fn();
      } catch (err) {
        console.error(`[delete-account] ${label} failed`, uid, err?.message || err);
        warnings.push(label);
      }
    };

    // 1. The sign-in account itself goes first.
    try {
      await auth.deleteUser(uid);
    } catch (err) {
      if (err?.code !== "auth/user-not-found") {
        console.error("[delete-account] auth delete failed", uid, err?.message || err);
        return res.status(500).json({ error: "Could not delete the account. Please try again." });
      }
    }

    // 2. Circles: leave every circle, hand over or close the ones left without an owner
    let circles = [];
    await attempt("find circles", async () => {
      const byMember = await db
        .collection("communities")
        .where("members", "array-contains", uid)
        .get();
      const byOwner = await db.collection("communities").where("createdBy", "==", uid).get();
      const seen = new Map();
      [...byMember.docs, ...byOwner.docs].forEach((d) => seen.set(d.id, d));
      circles = [...seen.values()];
    });

    for (const circle of circles) {
      const c = circle.data();
      const members = (c.members || []).filter((m) => m !== uid);
      const admins = (c.admins || []).filter((m) => m !== uid);

      await attempt(`leave circle ${circle.id}`, async () => {
        const update = {
          members,
          admins,
          memberCount: members.length,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (members.length === 0) {
          update.deleted = true;
          update.deletedAt = FieldValue.serverTimestamp();
          update.deletedBy = "account-deleted";
        } else if (c.createdBy === uid) {
          update.createdBy = admins[0] || members[0];
        }
        await circle.ref.update(update);
      });

      // 3a. what they wrote in this circle
      await attempt(`messages in ${circle.id}`, () =>
        deleteWhere(db, () => circle.ref.collection("messages").where("uid", "==", uid))
      );
      await attempt(`read marks in ${circle.id}`, async () => {
        await db.recursiveDelete(circle.ref.collection("reads").doc(uid));
        await circle.ref.collection("typing").doc(uid).delete();
      });
      await attempt(`questions in ${circle.id}`, async () => {
        const boards = await circle.ref.collection("boards").get();
        for (const board of boards.docs) {
          await deleteWhere(db, () => board.ref.collection("questions").where("uid", "==", uid));
        }
      });
    }

    // 3b. their replies on other people's questions (needs a collection-group index; skipped if missing)
    await attempt("replies", () =>
      deleteWhere(db, () => db.collectionGroup("replies").where("uid", "==", uid))
    );

    // 3c. analytics events and the profile document
    await attempt("events", () => deleteWhere(db, () => db.collection("events").where("uid", "==", uid)));
    await attempt("profile", () => db.recursiveDelete(userRef));

    return res.status(200).json({ ok: true, warnings });
  } catch (err) {
    console.error("[delete-account] crash", err);
    return res.status(500).json({ error: "Could not delete the account. Please try again." });
  }
}