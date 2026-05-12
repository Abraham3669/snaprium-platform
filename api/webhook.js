// api/webhook.js - Paddle Webhook Handler
import crypto from 'crypto';
import admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Firebase Admin init failed:', err.message);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let rawBody = '';
  for await (const chunk of req) {
    rawBody += chunk;
  }

  // === Paddle Signature Verification ===
  const signature = req.headers['paddle-signature'];
  const secret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('Missing PADDLE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Server config error' });
  }

  if (!signature) {
    console.error('Missing paddle-signature header');
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Paddle uses HMAC SHA256
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(rawBody).digest('hex');

  if (signature !== digest) {
    console.error('❌ Paddle signature mismatch');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  console.log('✅ Paddle signature verified');

  try {
    const payload = JSON.parse(rawBody);
    const eventName = payload.event_type;        // Paddle uses event_type
    const data = payload.data;

    console.log(`📥 Paddle Event: ${eventName}`);

    // Only process subscription-related events
    if (['subscription.created', 'subscription.updated', 'subscription.activated',
         'subscription.canceled', 'subscription.payment_succeeded', 'subscription.payment_failed'].includes(eventName)) {

      let userId = data.custom_data?.user_id;   // Best way: pass uid from frontend

      if (!userId) {
        console.error('No user_id in custom_data');
        return res.status(400).json({ error: 'Missing user_id' });
      }

      let plan = 'free';
      let status = 'inactive';

      // Determine plan from product name or metadata
      const productName = (data.product?.name || '').toLowerCase();
      if (productName.includes('unlimited') || productName.includes('premium')) {
        plan = 'unlimited';
      }

      // Determine status
      if (['subscription.activated', 'subscription.payment_succeeded'].includes(eventName)) {
        status = 'active';
      } else if (eventName === 'subscription.canceled') {
        status = 'canceled';
      }

      // Update Firestore
      const userRef = db.collection('users').doc(userId);

      await userRef.update({
        plan: plan,
        subscriptionStatus: status,
        subscriptionId: data.id,
        paddleCustomerId: data.customer_id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        nextBillingDate: data.next_billed_at ? new Date(data.next_billed_at) : null,
      });

      console.log(`✅ User ${userId} updated → Plan: ${plan} | Status: ${status}`);

      res.status(200).json({ received: true });
    } else {
      console.log(`ℹ️ Ignored event: ${eventName}`);
      res.status(200).json({ received: true });
    }
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
}