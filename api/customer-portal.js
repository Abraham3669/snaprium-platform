// api/customer-portal.js
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const paddleCustomerId = userData?.paddleCustomerId;

    console.log(`[Customer Portal] User ${userId} | Has Paddle ID: ${!!paddleCustomerId}`);

    if (!paddleCustomerId) {
      return res.status(400).json({ 
        error: 'No active subscription found. Please upgrade first.' 
      });
    }

    const paddleResponse = await fetch(
      `https://api.paddle.com/customers/${paddleCustomerId}/portal-sessions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!paddleResponse.ok) {
      const err = await paddleResponse.text();
      console.error('Paddle Error:', err);
      return res.status(502).json({ error: 'Failed to open Paddle portal' });
    }

    const paddleData = await paddleResponse.json();
    const portalUrl = paddleData?.data?.urls?.general?.overview || paddleData?.data?.url;

    if (!portalUrl) {
      return res.status(502).json({ error: 'Invalid Paddle response' });
    }

    res.status(200).json({ url: portalUrl });

  } catch (err) {
    console.error('Customer portal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}