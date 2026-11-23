// api/_feedCleanup.js   (underscore = not its own Vercel function)
//
// Removes everything a person made in the feed. Call it from api/delete-account.js, next to the code that
// already deletes their other data, BEFORE the auth user is deleted:
//
//     import { deleteFeedData } from "./_feedCleanup.js";
//     ...
//     await deleteFeedData(getFirestore(), uid);
//
// Removes: their posts (with those posts' replies and sparks), their replies and sparks on other people's posts
// (and fixes those counters), follows in both directions, their saved posts / feed settings, and their username
// (so it becomes free for someone else).

import { FieldValue } from "firebase-admin/firestore";

async function deleteQuery(db, query) {
  const snap = await query.get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

export async function deleteFeedData(db, uid) {
  if (!uid) return;

  // 1. their own posts, including each post's replies and sparks
  const posts = await db.collection("posts").where("uid", "==", uid).get();
  for (const d of posts.docs) await db.recursiveDelete(d.ref);

  // 2. their replies on other people's posts (keep the reply count honest)
  const replies = await db.collectionGroup("replies").where("uid", "==", uid).get();
  for (const r of replies.docs) {
    const postRef = r.ref.parent.parent;
    await r.ref.delete();
    if (postRef) await postRef.update({ replyCount: FieldValue.increment(-1) }).catch(() => {});
  }

  await deleteQuery(db, db.collection("replyIndex").where("uid", "==", uid)).catch(() => {});

  // 3. their sparks on other people's posts (their own-post sparks went with the post)
  const sparks = await db.collectionGroup("sparks").where("uid", "==", uid).get();
  for (const s of sparks.docs) {
    const postRef = s.ref.parent.parent;
    await s.ref.delete();
    if (postRef) {
      const post = await postRef.get();
      if (post.exists && post.data().uid !== uid) await postRef.update({ sparkCount: FieldValue.increment(-1) }).catch(() => {});
    }
  }

  // 4. follows both ways
  await deleteQuery(db, db.collection("follows").where("followerId", "==", uid));
  await deleteQuery(db, db.collection("follows").where("targetId", "==", uid));

  // 5. private feed data
  await db.recursiveDelete(db.collection("users").doc(uid).collection("saved")).catch(() => {});
  await db.recursiveDelete(db.collection("users").doc(uid).collection("feedPrefs")).catch(() => {});

  // 6. their username, so nobody is stuck with a name that belongs to a deleted account
  await deleteQuery(db, db.collection("handles").where("uid", "==", uid)).catch(() => {});
}