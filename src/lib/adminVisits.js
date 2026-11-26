// src/lib/adminVisits.js — numbers for the Visits tab, worked out from the visit records.
import { dayKey, toMillis } from "./adminMetrics";

const DAY = 86400000;

function top(map, n = 8) {
  return [...map.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.views - a.views)
    .slice(0, n);
}

export function computeVisits(rows, now = Date.now()) {
  const days = [];
  for (let i = 29; i >= 0; i -= 1) days.push(dayKey(now - i * DAY));
  const idx = new Map(days.map((d, i) => [d, i]));
  const perDay = days.map(() => new Set());
  const today = days[29];
  const wkStart = days[23];
  const prevStart = dayKey(now - 13 * DAY);

  const all = new Set();
  const week = new Set();
  const prevWeek = new Set();
  const todaySet = new Set();
  const live = new Set();
  const signed = new Set();
  const visitorDays = new Map();
  const pages = new Map();
  const refs = new Map();
  const platforms = new Map();
  const countries = new Map();
  let views = 0;
  let views7 = 0;

  for (const r of rows) {
    if (!r.vid || !r.day) continue;
    const i = idx.get(r.day);
    const inWindow = i !== undefined;
    const inPrev = r.day >= prevStart && r.day < wkStart;
    if (!inWindow && !inPrev) continue;
    if (inPrev) prevWeek.add(r.vid);
    if (!inWindow) continue;
    perDay[i].add(r.vid);
    all.add(r.vid);
    views += 1;
    if (r.day >= wkStart) {
      week.add(r.vid);
      views7 += 1;
    }
    if (r.day === today) todaySet.add(r.vid);
    const ms = toMillis(r.ts);
    if (ms !== null && now - ms < 30 * 60000) live.add(r.vid);
    if (r.uid) signed.add(r.vid);
    if (!visitorDays.has(r.vid)) visitorDays.set(r.vid, new Set());
    visitorDays.get(r.vid).add(r.day);

    const p = r.path || "/";
    const pg = pages.get(p) || { views: 0, people: new Set() };
    pg.views += 1;
    pg.people.add(r.vid);
    pages.set(p, pg);

    const rf = r.ref || "direct";
    const rr = refs.get(rf) || { views: 0, people: new Set() };
    rr.views += 1;
    rr.people.add(r.vid);
    refs.set(rf, rr);

    const cc = r.country || "";
    const co = countries.get(cc) || { views: 0, people: new Set() };
    co.views += 1;
    co.people.add(r.vid);
    countries.set(cc, co);

    const pl = r.platform || "pc";
    const pp = platforms.get(pl) || { views: 0, people: new Set() };
    pp.views += 1;
    pp.people.add(r.vid);
    platforms.set(pl, pp);
  }

  let returning = 0;
  visitorDays.forEach((s) => {
    if (s.size > 1) returning += 1;
  });

  const shape = (m) => top(m).map((x) => ({ id: x.id, views: x.views, people: x.people.size }));

  const recent = rows
    .map((r) => ({ ...r, ms: toMillis(r.ts) }))
    .filter((r) => r.ms !== null)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 25);

  return {
    days,
    daily: perDay.map((s) => s.size),
    today: todaySet.size,
    week: week.size,
    prevWeek: prevWeek.size,
    month: all.size,
    views,
    views7,
    live: live.size,
    signedIn: signed.size,
    guests: all.size - signed.size,
    returning,
    fresh: all.size - returning,
    pages: shape(pages),
    refs: shape(refs),
    platforms: shape(platforms),
    countries: top(countries, 12).map((x) => ({ id: x.id, views: x.views, people: x.people.size })),
    recent,
    hasData: rows.length > 0,
  };
}