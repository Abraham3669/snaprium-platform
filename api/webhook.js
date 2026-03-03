// api/webhook.js - Vercel serverless function for Lemon Squeezy webhooks
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
    console.log('Firebase Admin initialized successfully');
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message, err.stack);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  console.log('Webhook hit! Method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Read raw body for signature verification
  let rawBody = '';
  for await (const chunk of req) {
    rawBody += chunk;
  }

  // Verify signature (uncommented & fixed)
  const signature = req.headers['x-signature'];
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    console.error('Missing LEMON_SQUEEZY_WEBHOOK_SECRET env var');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!signature) {
    console.error('Missing x-signature header');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(rawBody).digest('hex');

  if (signature !== digest) {
    console.error('Signature mismatch');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  console.log('Signature verified');

  try {
    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;

    console.log('Event name:', eventName);

    // Handle relevant subscription events
    if (['subscription_created', 'subscription_updated', 'subscription_payment_success'].includes(eventName)) {
      const subscriptionData = payload.data;
      const attributes = subscriptionData.attributes;

      // Prefer custom_data.user_id (passed from checkout)
      let userId = payload.meta?.custom_data?.user_id;

      // Fallback to email lookup if no custom user_id
      if (!userId) {
        const customerEmail = attributes.user_email || subscriptionData.customer?.email;
        console.log('Customer email fallback:', customerEmail);

        if (!customerEmail) {
          console.error('No email or user_id in payload');
          return res.status(400).json({ error: 'Missing user identifier' });
        }

        const userSnapshot = await db.collection('users')
          .where('email', '==', customerEmail)
          .limit(1)
          .get();

        if (userSnapshot.empty) {
          console.error('No user found for email:', customerEmail);
          return res.status(404).json({ error: 'User not found' });
        }

        userId = userSnapshot.docs[0].id;
      }

      // Determine plan from product/variant name
      let plan = 'free';
      const productName = (attributes.product_name || attributes.variant_name || '').toLowerCase();
      if (productName.includes('pro')) plan = 'pro';
      if (productName.includes('premium')) plan = 'premium';

      // Update user doc
      await db.collection('users').doc(userId).update({
        subscription: plan,
        subscriptionId: subscriptionData.id,
        subscriptionStatus: attributes.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Optional: add more like renewal date, next billing, etc.
        // lastPayment: admin.firestore.FieldValue.serverTimestamp() for payment_success
      });

      console.log(`Updated user ${userId} to ${plan} (event: ${eventName})`);

      // Bonus: Log purchase to GA4 via Measurement Protocol (server-side)
      // Requires GA4_API_SECRET in env (create in GA4 > Admin > Data Streams > Measurement Protocol secrets)
      if (eventName === 'subscription_payment_success' || eventName === 'subscription_created') {
        const amount = attributes.total_amount || attributes.amount || 0; // in cents? Check payload
        const mpUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.VITE_FIREBASE_MEASUREMENT_ID}&api_secret=${process.env.GA4_API_SECRET}`;

        const gaEvent = {
          client_id: userId,
          events: [{
            name: 'purchase',
            params: {
              transaction_id: subscriptionData.id,
              value: Number(amount) / 100, // assume cents → dollars
              currency: 'USD',
              items: [{
                item_id: plan,
                item_name: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
                price: Number(amount) / 100,
                quantity: 1
              }]
            }
          }]
        };

        try {
          await fetch(mpUrl, {
            method: 'POST',
            body: JSON.stringify(gaEvent)
          });
          console.log(`GA4 purchase event sent for user ${userId}`);
        } catch (gaErr) {
          console.error('GA4 MP send failed:', gaErr);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal error' });
  }
}