// api/webhook.js - Improved for Production
import crypto from 'crypto';
import admin from 'firebase-admin';

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

  // Signature Verification
  const signature = req.headers['paddle-signature'];
  const secret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('❌ Missing PADDLE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Server config error' });
  }

  if (!signature) {
    console.error('❌ Missing paddle-signature header');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(rawBody).digest('hex');

  if (signature !== digest) {
    console.error('❌ Invalid Paddle signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const payload = JSON.parse(rawBody);
    const eventName = payload.event_type;
    const data = payload.data;

    console.log(`📥 Paddle Webhook Received: ${eventName}`);

    const userId = data?.custom_data?.user_id;

    if (!userId) {
      console.error('❌ No user_id found in custom_data');
      return res.status(400).json({ error: 'Missing user_id' });
    }

    let plan = 'free';
    let status = 'inactive';

    const productName = (data.product?.name || data.product?.name || '').toLowerCase();
    if (productName.includes('unlimited') || productName.includes('premium')) {
      plan = 'unlimited';
    }

    // Better event handling
    if (eventName === 'subscription.activated' || eventName === 'subscription.payment_succeeded') {
      status = 'active';
    } else if (eventName === 'subscription.canceled' || eventName === 'subscription.past_due') {
      status = 'canceled';
    }

    console.log(`🔄 Updating user ${userId} → Plan: ${plan}, Status: ${status}`);

    // Use set with merge instead of update (more reliable)
    await db.collection('users').doc(userId).set({
      plan,
      subscriptionStatus: status,
      subscriptionId: data.id,
      paddleCustomerId: data.customer_id,
      nextBillingDate: data.next_billed_at ? new Date(data.next_billed_at) : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✅ SUCCESS: User ${userId} updated to ${plan} (${status})`);

    return res.status(200).json({ received: true, userId, plan, status });

  } catch (err) {
    console.error('❌ Webhook processing error:', err.message);
    console.error('Full error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}