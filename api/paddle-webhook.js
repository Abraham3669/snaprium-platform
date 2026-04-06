// api/paddle-webhook.js
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

let db;

if (!getApps().length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({ credential: cert(serviceAccount) });
      console.log("✅ Firebase Admin initialized");
    } else {
      initializeApp();
    }
  } catch (e) {
    console.error("❌ Firebase Admin init failed:", e.message);
  }
}
db = getFirestore();

const WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  console.log("🔔 Paddle webhook received → Event:", req.body?.event_type);

  const signature = req.headers["paddle-signature"];
  let rawBody = JSON.stringify(req.body);

  const isValid = verifyPaddleSignature(rawBody, signature, WEBHOOK_SECRET);
  if (!isValid) {
    console.error("❌ Signature verification FAILED");
    return res.status(401).json({ error: "Invalid signature" });
  }

  console.log("✅ Signature verified");

  const { event_type, data } = req.body || {};

  try {
    if (event_type === "subscription.created" || event_type === "subscription.updated") {
      console.log("🔍 Processing subscription event");
      await handleSubscription(data);
    } else {
      console.log(`ℹ️ Received event: ${event_type} (ignored for now)`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("🚨 Webhook error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}

function verifyPaddleSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  try {
    const [ts, h1] = signatureHeader.split(";");
    const timestamp = ts.replace("ts=", "");
    const receivedSig = h1.replace("h1=", "");
    const signedPayload = `${timestamp}:${rawBody}`;
    const computed = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
    return computed === receivedSig;
  } catch (e) {
    console.error("Signature crash:", e);
    return false;
  }
}

async function handleSubscription(subscription) {
  // Detailed logging so we can debug
  console.log("📦 Full subscription data received:", JSON.stringify({
    id: subscription.id,
    status: subscription.status,
    custom_data: subscription.custom_data,
    priceId: subscription.items?.[0]?.price?.id,
  }, null, 2));

  let userId = subscription.custom_data?.user_id;

  if (!userId) {
    console.warn("⚠️ No user_id found in custom_data");
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

  console.log(`🎉 FIRESTORE UPDATED SUCCESSFULLY → User ${userId} is now ${plan}`);
}