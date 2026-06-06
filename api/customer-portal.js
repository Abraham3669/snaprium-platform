// api/customer-portal.js
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
    console.log('✅ Firebase Admin initialized for customer portal');
  } catch (err) {
    console.error('❌ Firebase Admin init failed:', err.message);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    console.error('❌ Customer portal: No userId provided');
    return res.status(400).json({ error: 'User ID required' });
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    if (!userData?.paddleCustomerId) {
      console.error(`❌ User ${userId} has no paddleCustomerId`);
      return res.status(400).json({ 
        error: 'No active subscription found. Please upgrade first.' 
      });
    }

    const portalUrl = `https://my.paddle.com/subscription/${userData.paddleCustomerId}`;

    console.log(`✅ Customer Portal opened for user: ${userId}`);

    res.status(200).json({ 
      success: true,
      url: portalUrl 
    });

  } catch (err) {
    console.error('❌ Customer portal error:', err.message);
    res.status(500).json({ error: 'Failed to generate customer portal' });
  }
}