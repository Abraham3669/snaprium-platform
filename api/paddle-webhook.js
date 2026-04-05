import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const signature = req.headers["paddle-signature"];
  console.log("🔔 Paddle webhook received:", req.body.event_type);

  if (!signature || !WEBHOOK_SECRET) {
    console.error("❌ Missing signature or webhook secret");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const rawBody = JSON.stringify(req.body);
  const isValid = verifySignature(rawBody, signature, WEBHOOK_SECRET);

  if (!isValid) {
    console.error("❌ Invalid Paddle signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { event_type, data } = req.body;

  try {
    if (event_type === "subscription.created" || event_type === "subscription.updated") {
      await handleSubscription(data);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("🚨 Error processing webhook:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function verifySignature(rawBody, signatureHeader, secret) {
  try {
    const [ts, h1] = signatureHeader.split(";");
    const timestamp = ts.replace("ts=", "");
    const signature = h1.replace("h1=", "");

    const signedPayload = `${timestamp}:${rawBody}`;
    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    return computedSignature === signature;
  } catch (e) {
    console.error("Signature verification failed:", e);
    return false;
  }
}

async function handleSubscription(subscription) {
  const userId = subscription.custom_data?.user_id;

  if (!userId) {
    console.warn("⚠️ No user_id found in custom_data");
    return;
  }

  const subscriptionId = subscription.id;
  const status = subscription.status;
  const priceId = subscription.items?.[0]?.price?.id;

  let plan = "free";
  if (priceId === "pri_01knfpxnmh74xf080p5z07x05j") plan = "pro";
  else if (priceId === "pri_01knfqbp8r1yqn4wrvq2xjh76p") plan = "premium";

  await db.collection("users").doc(userId).update({
    plan: plan,
    paddleSubscriptionId: subscriptionId,
    subscriptionStatus: status,
    updatedAt: new Date(),
  });

  console.log(`✅ Firestore updated successfully! User ${userId} → Plan: ${plan}`);
}