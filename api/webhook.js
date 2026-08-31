import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false,
  },
};

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
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    }
    console.log("Firebase Admin initialized");
  } catch (e) {
    console.error("Firebase Admin init failed:", e.message);
  }
}

const db = getFirestore();
const WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function verifyPaddleSignature(rawBody, signatureHeader, secret) {
  try {
    const parts = String(signatureHeader).split(";");
    const timestamp = parts
      .find((p) => p.startsWith("ts="))
      ?.replace("ts=", "")
      ?.trim();
    const receivedSig = parts
      .find((p) => p.startsWith("h1="))
      ?.replace("h1=", "")
      ?.trim();
    if (!timestamp || !receivedSig) return false;
    const signedPayload = `${timestamp}:${rawBody}`;
    const computedSig = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(computedSig),
      Buffer.from(receivedSig)
    );
  } catch (e) {
    console.error("Signature function error:", e);
    return false;
  }
}

function pickUserId(data) {
  return (
    data?.custom_data?.user_id ||
    data?.custom_data?.userId ||
    data?.items?.[0]?.custom_data?.user_id ||
    data?.subscription?.custom_data?.user_id ||
    null
  );
}

function pickEmail(data) {
  return (
    data?.customer?.email ||
    data?.custom_data?.email ||
    ""
  ).toLowerCase();
}

function pickPlan(data, eventType) {
  const productName = String(data?.product?.name || "").toLowerCase();
  const priceName = String(data?.items?.[0]?.price?.name || "").toLowerCase();
  const priceId = String(data?.items?.[0]?.price?.id || "").toLowerCase();
  const blob = `${productName} ${priceName} ${priceId}`;

  if (blob.includes("unlimited") || blob.includes("diamond")) return "unlimited";
  if (blob.includes("premium")) return "premium";
  if (blob.includes("pro")) return "pro";

  const paidEvents = [
    "subscription.activated",
    "subscription.created",
    "subscription.updated",
    "transaction.completed",
  ];
  if (paidEvents.includes(eventType) && data?.status !== "canceled") {
    return "unlimited";
  }
  return "free";
}

async function findUserRef(userId, email) {
  if (userId) return db.collection("users").doc(userId);

  if (email) {
    const snap = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].ref;
  }
  return null;
}

async function handleSubscriptionEvent(data, eventType) {
  const userId = pickUserId(data);
  const email = pickEmail(data);
  const userRef = await findUserRef(userId, email);

  if (!userRef) {
    console.error("No user_id or email match", {
      userId,
      email,
      keys: Object.keys(data || {}),
      custom_data: data?.custom_data || null,
    });
    return;
  }

  const plan = pickPlan(data, eventType);
  const status = data?.status || "active";

  await userRef.set(
    {
      paddleCustomerId: data?.customer_id || null,
      paddleSubscriptionId:
        data?.subscription_id ||
        data?.id ||
        null,
      plan,
      subscriptionStatus: status === "canceled" ? "inactive" : "active",
      nextBillingDate: data?.next_billed_at
        ? new Date(data.next_billed_at)
        : null,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  console.log("Updated user", userRef.id, "→", plan, status);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!WEBHOOK_SECRET) {
    console.error("Missing PADDLE_WEBHOOK_SECRET");
    return res.status(500).json({ error: "Server config error" });
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers["paddle-signature"];

  console.log("WEBHOOK", {
    signature: !!signature,
    rawLength: rawBody.length,
  });

  if (!signature) {
    return res.status(401).json({ error: "Missing signature" });
  }

  if (!verifyPaddleSignature(rawBody, signature, WEBHOOK_SECRET)) {
    console.error("Signature verification FAILED");
    return res.status(401).json({ error: "Invalid signature" });
  }

  try {
    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type;
    const data = payload.data;

    console.log("Event", eventType);

    if (
      [
        "subscription.activated",
        "subscription.created",
        "subscription.updated",
        "transaction.completed",
      ].includes(eventType)
    ) {
      await handleSubscriptionEvent(data, eventType);
    }

    if (
      ["subscription.canceled", "subscription.past_due"].includes(eventType)
    ) {
      const userRef = await findUserRef(pickUserId(data), pickEmail(data));
      if (userRef) {
        await userRef.set(
          {
            plan: "free",
            subscriptionStatus: "inactive",
            updatedAt: new Date(),
          },
          { merge: true }
        );
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}