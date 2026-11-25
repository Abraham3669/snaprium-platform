// src/lib/feedRank.js
//
// The Snaprium feed algorithm. Pure functions only (no Firebase, no React), so it is easy to test and to tune.
//
// The idea, in one paragraph: every post gets a score = quality x freshness x fit-for-you. Quality grows slowly with
// Sparks (people found it helpful) and replies; freshness decays with age (questions decay slower, they stay useful);
// fit is a boost for people and topics you care about. Then three fairness rules keep it healthy: brand-new posts get a
// short head start so nobody is invisible, posts you already saw sink, and the final list is re-ordered so one
// author or topic never fills the screen. Your own Spark on your own post never counts (the data layer keeps it out of
// sparkCount), so nobody can rank themselves up.
//
// Everything you may want to tune is in WEIGHTS.

export const WEIGHTS = {
  // quality
  base: 1,                 // every post starts with this, so a zero-Spark post still has a score
  spark: 2.2,              // weight of ln(1 + sparks)
  reply: 1.4,              // weight of ln(1 + replies)
  // freshness: score / (ageHours + offset) ^ gravity
  offsetHours: 2,
  gravity: 1.35,
  questionGravity: 0.95,   // questions stay relevant longer
  // fit
  followBoost: 2.0,        // author is someone you follow
  topicBoost: 0.35,        // per matching topic ...
  topicBoostMax: 1.7,      // ... up to this multiplier
  interactedBoost: 1.35,   // you sparked or replied to this author before
  // fairness
  newPostWindowHours: 3,
  newPostBoost: 1.25,      // a fresh post with no Sparks yet gets a short head start
  // Posts you already saw. Like X and LinkedIn, a post you have seen goes BELOW every post you have not seen yet
  // (unseenFirst). Among the seen ones, the longer ago you saw it, the higher it may come back, so a small feed
  // rotates instead of repeating the same top post. Seen time is refreshed every time you see it again.
  unseenFirst: true,
  seenMinFactor: 0.15,     // just seen
  seenMaxFactor: 0.75,     // seen long ago (after seenRecoverHours)
  seenRecoverHours: 72,
  ownPostFactor: 0.7,
  pinOwnMinutes: 0,        // no pinning: right after you post, your post is shown first for this visit only (see FeedHome); after a refresh it ranks like any other
  // questions
  unansweredBoost: 1.35,   // a question still waiting for an answer
  noReplyBoost: 1.2,       // ...and nobody replied yet (and it is under 2 days old)
  answeredFactor: 0.7,     // an answered question is less urgent
  // diversity
  authorRepeatPenalty: 0.6, // per time the same author appeared in the last `window` picks
  topicRepeatPenalty: 0.88,
  diversityWindow: 5,
  // variety between refreshes (+-)
  jitter: 0.06,
  // limits
  maxAgeDays: 120,         // older than this never appears in For you
};

const HOUR = 3600 * 1000;

export const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
};

// Small stable number in [0,1) from a string (so a refresh reshuffles a little, but a scroll never jumps).
export function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function scorePost(post, ctx, W = WEIGHTS) {
  const now = ctx.now ?? Date.now();
  const created = toMillis(post.createdAt) || now; // a post that is still being written counts as brand new
  const ageH = Math.max(0, (now - created) / HOUR);
  // the author's own Spark (selfSpark) never counts towards ranking
  const sparks = Math.max(0, (post.sparkCount || 0) - (post.selfSpark ? 1 : 0));
  const replies = Math.max(0, post.replyCount || 0);

  const quality = W.base + W.spark * Math.log1p(sparks) + W.reply * Math.log1p(replies);
  const gravity = post.kind === "question" ? W.questionGravity : W.gravity;
  let s = quality / Math.pow(ageH + W.offsetHours, gravity);

  // fit
  const mode = ctx.mode || "foryou";
  if (mode === "foryou" && ctx.following?.has(post.uid)) s *= W.followBoost;
  const topics = Array.isArray(post.topics) ? post.topics : [];
  if (ctx.topics?.size && topics.length) {
    const hits = topics.filter((t) => ctx.topics.has(t)).length;
    if (hits) s *= Math.min(W.topicBoostMax, 1 + W.topicBoost * hits);
  }
  if (ctx.interacted?.has(post.uid)) s *= W.interactedBoost;

  // new posts get a short head start
  if (ageH < W.newPostWindowHours && sparks === 0) s *= W.newPostBoost;

  // questions
  if (post.kind === "question") {
    if (post.answered) s *= W.answeredFactor;
    else {
      s *= W.unansweredBoost;
      if (replies === 0 && ageH < 48) s *= W.noReplyBoost;
    }
    if (mode === "questions" && post.answered) s *= 0.5;
  }

  // seen before? (ctx.seen maps postId -> time you last saw it). Your own posts count too: right after you post,
  // the feed page shows it first for that visit only; after that it rotates like any other.
  const seenAt = ctx.seen?.[post.id];
  if (seenAt) {
    const recovered = Math.min(1, Math.max(0, now - seenAt) / (W.seenRecoverHours * HOUR));
    s *= W.seenMinFactor + (W.seenMaxFactor - W.seenMinFactor) * recovered;
  }

  if (ctx.me && post.uid === ctx.me) s *= W.ownPostFactor;

  // a little variety between refreshes
  const j = (hash01(`${post.id}:${ctx.seed || 0}`) - 0.5) * 2 * W.jitter;
  return s * (1 + j);
}

// Is this post allowed in this person's feed at all?
export function eligible(post, ctx, W = WEIGHTS) {
  if (!post || !post.id || !post.uid) return false;
  if (post.deleted === true) return false;
  if (ctx.blocked?.has(post.uid)) return false;
  if (ctx.hidden?.has(post.id)) return false;
  const created = toMillis(post.createdAt);
  const now = ctx.now ?? Date.now();
  if (created && now - created > W.maxAgeDays * 24 * HOUR && (ctx.mode || "foryou") === "foryou") return false;
  if (ctx.mode === "questions" && post.kind !== "question") return false;
  return true;
}

// Greedy re-order: keep the best post next, but push down an author or a topic that just appeared.
export function diversify(scored, W = WEIGHTS) {
  const pool = scored.map((x) => ({ ...x }));
  const out = [];
  while (pool.length) {
    const recent = out.slice(-W.diversityWindow);
    let bestIdx = 0;
    let best = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      const sameAuthor = recent.filter((r) => r.post.uid === p.post.uid).length;
      const t0 = p.post.topics?.[0];
      const sameTopic = t0 ? recent.slice(-3).filter((r) => r.post.topics?.[0] === t0).length : 0;
      const adj = p.score * Math.pow(W.authorRepeatPenalty, sameAuthor) * Math.pow(W.topicRepeatPenalty, sameTopic);
      if (adj > best) {
        best = adj;
        bestIdx = i;
      }
    }
    out.push(pool.splice(bestIdx, 1)[0]);
  }
  return out;
}

/**
 * Rank a list of candidate posts.
 *   posts  array of { id, uid, kind, topics, sparkCount, replyCount, answered, createdAt, ... }
 *   ctx    { me, mode: "foryou"|"following"|"questions", now, seed, following:Set, topics:Set, blocked:Set,
 *            hidden:Set, seen:{id:ms last seen}, interacted:Set }
 * Returns posts in display order.
 *   following  -> plain newest first (a follow feed should be predictable)
 *   foryou / questions -> scored + diversified
 */
export function rankFeed(posts, ctx = {}, W = WEIGHTS) {
  const seenIds = new Set();
  const list = [];
  for (const p of posts || []) {
    if (!p || seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    if (!eligible(p, ctx, W)) continue;
    list.push(p);
  }
  if (ctx.mode === "following") {
    const f = ctx.following || new Set();
    return list
      .filter((p) => f.has(p.uid))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt) || (a.id < b.id ? 1 : -1));
  }
  // Something you just posted stays at the top for a while, so it never looks like it vanished.
  const now = ctx.now ?? Date.now();
  const isFreshOwn = (p) => ctx.me && p.uid === ctx.me && (!toMillis(p.createdAt) || now - toMillis(p.createdAt) < W.pinOwnMinutes * 60000);
  const pinned = list.filter(isFreshOwn).sort((a, b) => (toMillis(b.createdAt) || now) - (toMillis(a.createdAt) || now));
  const rest = list.filter((p) => !isFreshOwn(p));
  const scored = rest.map((post) => ({ post, score: scorePost(post, ctx, W) }));
  scored.sort((a, b) => b.score - a.score || (a.post.id < b.post.id ? -1 : 1));
  // Unseen first, seen after (each group keeps the normal score order and the author / topic variety rules).
  if (W.unseenFirst && ctx.seen) {
    const isSeen = (x) => !!ctx.seen[x.post.id];
    const fresh = scored.filter((x) => !isSeen(x));
    // Seen posts: the one you saw LONGEST AGO comes first, the one you just saw goes last. Likes and replies do not
    // matter here, so a popular post you already viewed can never sit on top again while others wait.
    const old = scored.filter(isSeen).sort((a, b) => ctx.seen[a.post.id] - ctx.seen[b.post.id] || b.score - a.score);
    return [...pinned, ...diversify(fresh, W).map((x) => x.post), ...old.map((x) => x.post)];
  }
  return [...pinned, ...diversify(scored, W).map((x) => x.post)];
}

// "Waiting for an answer": unanswered questions, newest unanswered with fewest replies first.
export function waitingQuestions(posts, ctx = {}, limit = 3) {
  return (posts || [])
    .filter((p) => p.kind === "question" && !p.answered && eligible(p, { ...ctx, mode: "questions" }))
    .filter((p) => p.uid !== ctx.me)
    .sort((a, b) => (a.replyCount || 0) - (b.replyCount || 0) || toMillis(b.createdAt) - toMillis(a.createdAt))
    .slice(0, limit);
}

// Time of day label, shared by cards: "now", "5m", "3h", "2d", "Mar 4"
export function timeAgo(createdAt, now = Date.now()) {
  const t = toMillis(createdAt);
  if (!t) return "now";
  const mins = Math.floor((now - t) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
}