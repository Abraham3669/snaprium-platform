// api/webhook.js - FINAL VERSION (Clean + Reliable)
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

let db;

if (!getApps().length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
    console.log("✅ Firebase Admin initialized successfully");
  } catch (e) {
    console.error("❌ Firebase Admin init failed:", e.message);
  }
}

db = getFirestore();

const WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get raw body (required for Paddle signature verification)
  let rawBody = '';
  for await (const chunk of req) {
    rawBody += chunk;
  }

  const signature = req.headers["paddle-signature"];

  console.log(`🔔 Paddle Webhook Received → Event: ${req.body?.event_type || 'unknown'}`);

  if (!WEBHOOK_SECRET) {
    console.error("❌ Missing PADDLE_WEBHOOK_SECRET in environment variables");
    return res.status(500).json({ error: "Server configuration error" });
  }

  if (!signature) {
    console.error("❌ Missing paddle-signature header");
    return res.status(401).json({ error: "Missing signature" });
  }

  const isValid = verifyPaddleSignature(rawBody, signature, WEBHOOK_SECRET);
  if (!isValid) {
    console.error("❌ Invalid Paddle signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  console.log("✅ Signature verified successfully");

  try {
    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type;
    const data = payload.data;

    if (["subscription.activated", "subscription.created", "subscription.updated", "transaction.completed"].includes(eventType)) {
      await handleSubscriptionEvent(data, eventType);
    } else {
      console.log(`ℹ️ Ignored event type: ${eventType}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("🚨 Webhook processing error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ====================== HELPER FUNCTIONS ======================

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
    console.error("Signature verification failed:", e);
    return false;
  }
}

async function handleSubscriptionEvent(data, eventType) {
  const userId = data?.custom_data?.user_id || data?.customer?.custom_data?.user_id;

  if (!userId) {
    console.warn("⚠️ No user_id found in custom_data");
    return;
  }

  const customerId = data?.customer_id || data?.customer?.id;
  const subscriptionId = data?.id || data?.subscription_id;

  // === Plan Detection (Diamond / Unlimited) ===
  let plan = "free";
  const priceId = data?.items?.[0]?.price?.id || data?.price_id;
  const productName = (
    data?.product?.name ||
    data?.items?.[0]?.price?.product?.name ||
    ""
  ).toLowerCase();

  if (priceId?.includes("unlimited") || productName.includes("unlimited") || productName.includes("diamond")) {
    plan = "unlimited";
  } else if (priceId?.includes("premium") || productName.includes("premium")) {
    plan = "premium";
  } else if (priceId?.includes("pro") || productName.includes("pro")) {
    plan = "pro";
  }

  await db.collection("users").doc(userId).set({
    paddleCustomerId: customerId,
    paddleSubscriptionId: subscriptionId,
    plan: plan,
    subscriptionStatus: data?.status || "active",
    nextBillingDate: data?.next_billed_at ? new Date(data.next_billed_at) : null,
    updatedAt: new Date(),
  }, { merge: true });

  console.log(`🎉 SUCCESS → User ${userId} updated to ${plan} (Diamond/Unlimited support enabled)`);
}