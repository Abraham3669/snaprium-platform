// src/lib/adminMetrics.js
// Pure functions that turn raw events + users into the numbers on the Analytics tab.
// No Firebase in here, so it is easy to test. All days are UTC.

const DAY_MS = 86400000;

export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

export function lastDays(n, now = Date.now()) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(dayKey(now - i * DAY_MS));
  return out;
}

export function toMillis(v) {
  if (!v) return null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.toDate === "function") return v.toDate().getTime();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

export const FUNNEL_STEPS = [
  { key: "signed", label: "Signed up" },
  { key: "returned", label: "Came back on another day" },
  { key: "circle", label: "Joined or created a circle" },
  { key: "took_part", label: "Chatted, asked or answered" },
  { key: "call", label: "Joined a live session" },
];

export function computeMetrics({ events = [], users = [], now = Date.now(), windowDays = 30 }) {
  const days = lastDays(windowDays, now);
  const last = days.length - 1;
  const index = new Map(days.map((d, i) => [d, i]));

  const perDay = days.map(() => new Set());
  const byUser = new Map(); // uid -> { days:Set, types:Set }
  const weekly = { current: {}, previous: {} };

  for (const e of events) {
    const i = index.get(e.day);
    if (i === undefined || !e.uid) continue;
    perDay[i].add(e.uid);

    let u = byUser.get(e.uid);
    if (!u) {
      u = { days: new Set(), types: new Set() };
      byUser.set(e.uid, u);
    }
    u.days.add(e.day);
    u.types.add(e.type);

    const pos = last - i; // 0 = today
    const bucket = pos < 7 ? weekly.current : pos < 14 ? weekly.previous : null;
    if (bucket) bucket[e.type] = (bucket[e.type] || 0) + 1;
  }

  const union = (from, to) => {
    const s = new Set();
    for (let i = from; i <= to; i += 1) if (perDay[i]) perDay[i].forEach((x) => s.add(x));
    return s;
  };

  const dau = perDay.map((s) => s.size);
  const wau = union(last - 6, last).size;
  const prevWau = union(last - 13, last - 7).size;
  const avgDau7 = dau.slice(last - 6).reduce((a, b) => a + b, 0) / 7;

  // sign-ups (from user profiles: createdAt, or signupAt written by the app)
  const signupsByDay = days.map(() => 0);
  const signups = []; // { uid, day, pos }
  for (const u of users) {
    const ms = toMillis(u.createdAt) ?? toMillis(u.signupAt);
    if (ms === null) continue;
    const d = dayKey(ms);
    const i = index.get(d);
    if (i === undefined) continue;
    signupsByDay[i] += 1;
    signups.push({ uid: u.id || u.uid, day: d, pos: last - i });
  }
  const sum = (arr, from, to) => arr.slice(from, to + 1).reduce((a, b) => a + b, 0);

  // week-1 return: people who signed up 7-13 days ago and were active in the last 7 days
  const cohort = signups.filter((s) => s.pos >= 7 && s.pos <= 13);
  const returned = cohort.filter((s) => {
    const u = byUser.get(s.uid);
    if (!u) return false;
    for (let i = last - 6; i <= last; i += 1) if (u.days.has(days[i])) return true;
    return false;
  }).length;

  // activation funnel for everyone who signed up in the window
  const has = (uid, types) => {
    const u = byUser.get(uid);
    return !!u && types.some((t) => u.types.has(t));
  };
  const funnelCounts = {
    signed: signups.length,
    returned: signups.filter((s) => {
      const u = byUser.get(s.uid);
      return !!u && Array.from(u.days).some((d) => d !== s.day);
    }).length,
    circle: signups.filter((s) => has(s.uid, ["circle_join", "circle_create"])).length,
    took_part: signups.filter((s) =>
      has(s.uid, ["chat_message", "question_post", "reply_post"])
    ).length,
    call: signups.filter((s) => has(s.uid, ["call_join"])).length,
  };

  return {
    days,
    dau,
    dauToday: dau[last],
    wau,
    prevWau,
    stickiness: wau ? avgDau7 / wau : 0,
    signupsByDay,
    signups7: sum(signupsByDay, last - 6, last),
    signupsPrev7: sum(signupsByDay, last - 13, last - 7),
    week1: { cohort: cohort.length, returned, rate: cohort.length ? returned / cohort.length : null },
    funnel: FUNNEL_STEPS.map((s) => ({ ...s, count: funnelCounts[s.key] })),
    weekly,
    eventCount: events.length,
    hasEvents: events.length > 0,
  };
}