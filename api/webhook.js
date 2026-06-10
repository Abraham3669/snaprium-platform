// api/webhook.js - PERFECT MATCH FOR YOUR PADDLE PAYLOAD
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
    console.log("✅ Firebase Admin initialized");
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

  let rawBody = '';
  for await (const chunk of req) {
    rawBody += chunk;
  }

  const signature = req.headers["paddle-signature"];

  console.log("=== WEBHOOK DEBUG ===");
  console.log("Event Type:", req.body?.event_type);
  console.log("Signature Present:", !!signature);
  console.log("Raw Body Length:", rawBody.length);

  if (!WEBHOOK_SECRET) {
    console.error("❌ Missing PADDLE_WEBHOOK_SECRET");
    return res.status(500).json({ error: "Server config error" });
  }
  if (!signature) {
    console.error("❌ Missing paddle-signature header");
    return res.status(401).json({ error: "Missing signature" });
  }

  const isValid = verifyPaddleSignature(rawBody, signature, WEBHOOK_SECRET);
  if (!isValid) {
    console.error("❌ Signature verification FAILED");
    return res.status(401).json({ error: "Invalid signature" });
  }

  console.log("✅ Signature verified successfully");

  try {
    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type;
    const data = payload.data;

    console.log(`📥 Processing event: ${eventType} | Product: ${data?.product?.name}`);

    if (["subscription.activated", "subscription.created", "subscription.updated", "transaction.completed"].includes(eventType)) {
      await handleSubscriptionEvent(data);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("🚨 Webhook error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}

function verifyPaddleSignature(rawBody, signatureHeader, secret) {
  try {
    const [tsPart, h1Part] = signatureHeader.split(";");
    const timestamp = tsPart.replace("ts=", "");
    const receivedSig = h1Part.replace("h1=", "");

    const signedPayload = `${timestamp}:${rawBody}`;
    const computedSig = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

    return computedSig === receivedSig;
  } catch (e) {
    console.error("Signature function error:", e);
    return false;
  }
}

async function handleSubscriptionEvent(data) {
  const userId = data?.custom_data?.user_id;

  if (!userId) {
    console.error("❌ No user_id in custom_data");
    console.log("Available keys in data:", Object.keys(data || {}));
    return;
  }

  const customerId = data?.customer_id;
  const subscriptionId = data?.id;

  // === EXACT MATCH FOR YOUR "Unlimited Plan" PAYLOAD ===
  let plan = "free";
  const productName = (data?.product?.name || "").toLowerCase();
  const priceName = (data?.items?.[0]?.price?.name || "").toLowerCase();

  if (productName.includes("unlimited") || priceName.includes("unlimited") || productName.includes("diamond")) {
    plan = "unlimited";
  } else if (productName.includes("premium")) {
    plan = "premium";
  } else if (productName.includes("pro")) {
    plan = "pro";
  }

  console.log(`🔄 Updating user ${userId} → Plan: ${plan}`);

  await db.collection("users").doc(userId).set({
    paddleCustomerId: customerId,
    paddleSubscriptionId: subscriptionId,
    plan: plan,
    subscriptionStatus: data?.status || "active",
    nextBillingDate: data?.next_billed_at ? new Date(data.next_billed_at) : null,
    updatedAt: new Date(),
  }, { merge: true });

  console.log(`🎉 SUCCESS → User ${userId} updated to ${plan}`);
}