// api/paddle-webhook.js
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

let db;

if (!getApps().length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("✅ Firebase Admin initialized with service account");
    } else {
      console.error("❌ FIREBASE_SERVICE_ACCOUNT env variable is missing");
      initializeApp(); // fallback
    }
  } catch (error) {
    console.error("🚨 Firebase Admin initialization failed:", error.message);
  }
}

db = getFirestore();

const WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("🔔 Paddle webhook received - Event:", req.body?.event_type);

  const signature = req.headers["paddle-signature"];

  if (!WEBHOOK_SECRET) {
    console.error("❌ PADDLE_WEBHOOK_SECRET is not set in Vercel");
    return res.status(500).json({ error: "Webhook secret missing" });
  }

  if (!signature) {
    console.error("❌ No paddle-signature header");
    return res.status(401).json({ error: "No signature" });
  }

  // Get raw body exactly as Paddle sent it
  let rawBody = "";
  try {
    rawBody = JSON.stringify(req.body);
  } catch (e) {
    rawBody = String(req.body || "");
  }

  const isValid = verifyPaddleSignature(rawBody, signature, WEBHOOK_SECRET);

  if (!isValid) {
    console.error("❌ Signature verification FAILED");
    return res.status(401).json({ error: "Invalid signature" });
  }

  console.log("✅ Paddle signature verified successfully");

  const { event_type, data } = req.body || {};

  try {
    if (event_type === "subscription.created" || event_type === "subscription.updated") {
      await handleSubscription(data);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("🚨 Error in webhook handler:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function verifyPaddleSignature(rawBody, signatureHeader, secret) {
  try {
    const [tsPart, h1Part] = signatureHeader.split(";");
    const timestamp = tsPart.replace("ts=", "");
    const receivedSig = h1Part.replace("h1=", "");

    const signedPayload = `${timestamp}:${rawBody}`;
    const computedSig = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    return computedSig === receivedSig;
  } catch (e) {
    console.error("Signature verification error:", e);
    return false;
  }
}

async function handleSubscription(subscription) {
  const userId = subscription?.custom_data?.user_id;

  if (!userId) {
    console.warn("⚠️ No user_id in custom_data");
    return;
  }

  const priceId = subscription.items?.[0]?.price?.id;
  let plan = "free";

  if (priceId === "pri_01knfpxnmh74xf080p5z07x05j") plan = "pro";
  else if (priceId === "pri_01knfqbp8r1yqn4wrvq2xjh76p") plan = "premium";

  await db.collection("users").doc(userId).update({
    plan: plan,
    paddleSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    updatedAt: new Date(),
  });

  console.log(`🎉 Firestore updated! User ${userId} → Plan: ${plan}`);
}