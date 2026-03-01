// api/webhook.js
import { buffer } from 'micro';
import crypto from 'crypto';
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message);
  }
}

const db = admin.firestore();

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  console.log('Webhook hit! Method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const rawBody = buf.toString('utf8');

  // Verify signature
  const signature = req.headers['x-signature'];
  const hmac = crypto.createHmac('sha256', process.env.LEMON_SQUEEZY_WEBHOOK_SECRET);
  const digest = hmac.update(buf).digest('hex');

  if (signature !== digest) {
    console.error('Signature mismatch. Received:', signature, 'Expected:', digest);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  console.log('Signature valid');

  try {
    const event = JSON.parse(rawBody);
    console.log('Event name:', event.meta.event_name);
    console.log('Full event data:', JSON.stringify(event, null, 2));

    if (event.meta.event_name === 'subscription_created' || 
        event.meta.event_name === 'subscription_updated' ||
        event.meta.event_name === 'subscription_payment_success') {
      
      const subscription = event.data;
      const userId = subscription.meta?.custom_fields?.user_id;

      console.log('User ID from webhook:', userId);

      if (!userId) {
        console.error('No user_id in custom_fields');
        return res.status(400).json({ error: 'Missing user_id' });
      }

      let plan = 'free';
      if (subscription.product?.name?.toLowerCase().includes('pro')) plan = 'pro';
      if (subscription.product?.name?.toLowerCase().includes('premium')) plan = 'premium';

      await db.collection('users').doc(userId).update({
        subscription: plan,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`User ${userId} updated to ${plan}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message, err.stack);
    return res.status(400).json({ error: err.message });
  }
}