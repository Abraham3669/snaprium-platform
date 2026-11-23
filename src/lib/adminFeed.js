// src/lib/adminFeed.js
//
// Pure helpers for the owner's admin page (no Firebase, no React): feed numbers worked out from the posts that
// are already loaded, repeat-report counting, sorting and CSV export. Days are UTC, the same as the Analytics tab.

import { toMillis } from "./feedRank";

const DAY = 86400000;
export const feedDayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Numbers for the Feed section of the Analytics tab. `posts` = the latest posts the page loaded. */
export function computeFeedStats(posts, now = Date.now(), days = 30) {
  const list = Array.isArray(posts) ? posts : [];
  const keys = [];
  for (let i = days - 1; i >= 0; i--) keys.push(feedDayKey(now - i * DAY));
  const index = new Map(keys.map((k, i) => [k, i]));
  const perDay = keys.map(() => 0);

  const kinds = new Map();
  const topics = new Map();
  const authors = new Map();
  let sparks = 0;
  let replies = 0;
  let last7 = 0;
  let prev7 = 0;
  let questions = 0;
  let answered = 0;
  const waiting = [];

  for (const p of list) {
    const ms = toMillis(p.createdAt);
    if (ms) {
      const i = index.get(feedDayKey(ms));
      if (i !== undefined) perDay[i] += 1;
      const age = now - ms;
      if (age < 7 * DAY) last7 += 1;
      else if (age < 14 * DAY) prev7 += 1;
    }
    const kind = p.kind || "post";
    kinds.set(kind, (kinds.get(kind) || 0) + 1);
    for (const t of p.topics || []) topics.set(t, (topics.get(t) || 0) + 1);
    const sc = Number(p.sparkCount) || 0;
    const rc = Number(p.replyCount) || 0;
    sparks += sc;
    replies += rc;
    if (p.uid) {
      const a = authors.get(p.uid) || { uid: p.uid, name: p.authorName || "Member", posts: 0, sparks: 0, replies: 0 };
      a.posts += 1;
      a.sparks += sc;
      a.replies += rc;
      authors.set(p.uid, a);
    }
    if (kind === "question") {
      questions += 1;
      if (p.answered) answered += 1;
      else if (!rc && ms && now - ms > DAY) waiting.push(p);
    }
  }

  const byCount = (m) => [...m.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
  const sparkOf = (p) => Number(p.sparkCount) || 0;
  return {
    total: list.length,
    days: keys,
    perDay,
    last7,
    prev7,
    sparks,
    replies,
    avgSparks: list.length ? sparks / list.length : 0,
    kinds: byCount(kinds),
    topics: byCount(topics).slice(0, 8),
    authors: [...authors.values()].sort((a, b) => b.sparks + b.replies - (a.sparks + a.replies) || b.posts - a.posts).slice(0, 5),
    topPosts: [...list].filter((p) => sparkOf(p) > 0).sort((a, b) => sparkOf(b) - sparkOf(a)).slice(0, 5),
    questions,
    answered,
    answerRate: questions ? answered / questions : null,
    waiting: waiting.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)).slice(0, 5),
  };
}

/** How many times each reported thing was reported (so repeats stand out). Key = type + id. */
export const reportKey = (r) => `${r.type || "community"}:${r.contentId || r.contentUid || r.communityId || r.id}`;
export function countReports(reports) {
  const m = new Map();
  for (const r of reports || []) m.set(reportKey(r), (m.get(reportKey(r)) || 0) + 1);
  return m;
}

/** Sort users: "new" (joined), "active" (last seen), "name". Missing dates go last. */
export function sortUsers(users, how) {
  const joined = (u) => toMillis(u.createdAt || u.signupAt) || 0;
  const active = (u) => toMillis(u.lastActiveAt) || 0;
  const name = (u) => String(u.displayName || u.name || u.email || u.id || "").toLowerCase();
  const copy = [...users];
  if (how === "new") copy.sort((a, b) => joined(b) - joined(a));
  else if (how === "active") copy.sort((a, b) => active(b) - active(a));
  else if (how === "name") copy.sort((a, b) => name(a).localeCompare(name(b)));
  return copy;
}

const cell = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stops spreadsheets running a pasted "formula"
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (header, rows) => [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

export function downloadCsv(filename, csv) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}