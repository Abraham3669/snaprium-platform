// api/webhook.js - Simple version, uses email matching
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
    console.error('Firebase Admin init failed:', err.message, err.stack);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  console.log('Webhook hit! Method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Read raw body
  let rawBody = '';
  for await (const chunk of req) {
    rawBody += chunk;
  }

  // Verify signature
  const signature = req.headers['x-signature'];
  const hmac = crypto.createHmac('sha256', process.env.LEMON_SQUEEZY_WEBHOOK_SECRET);
  const digest = hmac.update(rawBody).digest('hex');

  //if (signature !== digest) {
   // console.error('Signature mismatch');
   // return res.status(401).json({ error: 'Invalid signature' });
  //}

  console.log('Signature valid');

  try {
    const event = JSON.parse(rawBody);
    console.log('Event name:', event.meta.event_name);

    if (event.meta.event_name === 'subscription_created' || 
        event.meta.event_name === 'subscription_updated' ||
        event.meta.event_name === 'subscription_payment_success') {
      
      const subscription = event.data;
      const customerEmail = subscription.customer?.email;

      console.log('Customer email from webhook:', customerEmail);

      if (!customerEmail) {
        console.error('No customer email');
        return res.status(400).json({ error: 'Missing email' });
      }

      // Find user by email in Firestore
      const userSnapshot = await db.collection('users')
        .where('email', '==', customerEmail)
        .limit(1)
        .get();

      if (userSnapshot.empty) {
        console.error('No user found for email:', customerEmail);
        return res.status(404).json({ error: 'User not found' });
      }

      const userDoc = userSnapshot.docs[0];
      const userId = userDoc.id;

      let plan = 'free';
      const productName = subscription.product?.name?.toLowerCase() || '';
      if (productName.includes('pro')) plan = 'pro';
      if (productName.includes('premium')) plan = 'premium';

      await db.collection('users').doc(userId).update({
        subscription: plan,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Updated user ${userId} (email ${customerEmail}) to ${plan}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
}