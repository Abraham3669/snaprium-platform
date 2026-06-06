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

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    console.log(`Customer Portal Request for user ${userId}:`, {
      exists: userDoc.exists,
      hasPaddleId: !!userData?.paddleCustomerId,
      paddleCustomerId: userData?.paddleCustomerId
    });

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userData?.paddleCustomerId) {
      return res.status(400).json({ 
        error: 'No subscription linked. Please contact support.' 
      });
    }

    const portalUrl = `https://my.paddle.com/subscription/${userData.paddleCustomerId}`;

    res.status(200).json({ url: portalUrl });

  } catch (err) {
    console.error('Customer portal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}