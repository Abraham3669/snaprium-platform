// api/_billing.js   (the underscore keeps Vercel from counting it as its own function)
//
// Reached through api/daily-room.js whenever the request body has action "billing:sync".
//
// WHY THIS EXISTS: the phone must never decide by itself that someone is subscribed (anyone could
// fake that). Here the SERVER asks RevenueCat "does this person have an active subscription?" and
// only the server writes the plan.
//
//   { action: "billing:sync" }   signed-in person (Firebase ID token in the Authorization header)
//     - active in RevenueCat  -> plan "unlimited"
//     - not active, and the plan was granted by the App Store / Google Play -> back to "free"
//     - web (Paddle) subscribers and manual admin grants are never touched here
//
// Vercel environment variable needed:
//   REVENUECAT_SECRET_KEY   RevenueCat > Project settings > API keys > Secret API keys > New (API v1)
// Optional:
//   REVENUECAT_ENTITLEMENT  defaults to "unlimited"

import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const ENTITLEMENT = process.env.REVENUECAT_ENTITLEMENT || "unlimited";
const STORE_SOURCES = new Set(["ios", "android"]);

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

// RevenueCat REST API v1: the subscriber's entitlements, straight from RevenueCat.
async function fetchEntitlement(appUserId) {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) throw new Error("REVENUECAT_SECRET_KEY is not set");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let resp;
  try {
    resp = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error(`RevenueCat answered ${resp.status}`);

  const json = await resp.json();
  const sub = json?.subscriber || {};
  const ent = sub.entitlements?.[ENTITLEMENT];
  if (!ent) return { active: false, source: "" };

  const expires = ent.expires_date ? Date.parse(ent.expires_date) : null; // null = lifetime
  const active = expires === null || (Number.isFinite(expires) && expires > Date.now());

  const store = sub.subscriptions?.[ent.product_identifier]?.store || "";
  const source = store === "play_store" ? "android" : store === "app_store" || store === "mac_app_store" ? "ios" : "";
  return { active, source };
}

export async function handleBilling(req, res) {
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

    let result;
    try {
      result = await fetchEntitlement(uid);
    } catch (err) {
      console.error("[billing] revenuecat lookup failed", err?.message || err);
      // Do not change anything when we could not check: never lock someone out because of our own hiccup.
      return res.status(502).json({ ok: false, error: "Could not check your subscription right now" });
    }

    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : {};
    const currentPlan = data.plan || "free";

    if (result.active) {
      if (currentPlan !== "unlimited" && currentPlan !== "premium") {
        await ref.set(
          {
            plan: "unlimited",
            isUnlimited: true,
            subscriptionStatus: "active",
            subscriptionSource: result.source || "ios",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      return res.status(200).json({ ok: true, active: true, plan: "unlimited" });
    }

    // Not active in RevenueCat. Only undo plans that came from the store.
    const granted = String(data.subscriptionSource || "");
    if ((currentPlan === "unlimited" || currentPlan === "premium") && STORE_SOURCES.has(granted)) {
      await ref.set(
        {
          plan: "free",
          isUnlimited: false,
          subscriptionStatus: "inactive",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return res.status(200).json({ ok: true, active: false, plan: "free" });
    }

    return res.status(200).json({ ok: true, active: false, plan: currentPlan });
  } catch (err) {
    console.error("[billing] failed", err);
    return res.status(500).json({ ok: false, error: "Could not check your subscription" });
  }
}