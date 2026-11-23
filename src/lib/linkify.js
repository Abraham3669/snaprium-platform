// src/lib/linkify.js
// Turns web addresses inside post and reply text into safe, tappable links.
//  - only http:// and https:// addresses become links, everything else stays plain text
//  - opens in a new tab with rel="nofollow noopener noreferrer ugc" (search engines give spam no credit, and the
//    other site cannot reach this page)
//  - the shown text drops "https://" and is shortened when very long
import { createElement, Fragment } from "react";

const URL_RE = /https?:\/\/[^\s<>"]+/gi;
const TRAIL = /[.,;:!?)\]}'"]+$/;
const SHOW_MAX = 42;

// [{ start, end, url }] for every address in the text (trailing punctuation is not part of the address)
export function findLinks(text) {
  const out = [];
  if (!text) return out;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    const trail = url.match(TRAIL);
    if (trail) url = url.slice(0, url.length - trail[0].length);
    if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(url)) continue; // needs a real-looking host
    out.push({ start: m.index, end: m.index + url.length, url });
  }
  return out;
}

const shown = (url) => {
  const s = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return s.length > SHOW_MAX ? `${s.slice(0, SHOW_MAX - 1)}…` : s;
};

// Cut a long text for "Show more" without ever cutting an address in half.
// Shortens to `max` characters and, when given, `maxLines` lines (blank lines count), never inside a link.
export const needsClamp = (text, max, maxLines = 0) =>
  text.length > max || (maxLines > 0 && text.split("\n").length > maxLines);

export function clampText(text, max, maxLines = 0) {
  if (!needsClamp(text, max, maxLines)) return text;
  let cut = Math.min(max, text.length);
  if (maxLines > 0) {
    let at = -1;
    for (let i = 0; i < maxLines; i++) {
      at = text.indexOf("\n", at + 1);
      if (at === -1) break;
    }
    if (at !== -1 && at < cut) cut = at;
  }
  for (const l of findLinks(text)) {
    if (cut > l.start && cut < l.end) {
      cut = l.start;
      break;
    }
  }
  return `${text.slice(0, cut).trimEnd()}…`;
}

export default function LinkedText({ text }) {
  const links = findLinks(text);
  if (!links.length) return text;
  const parts = [];
  let at = 0;
  links.forEach((l, i) => {
    if (l.start > at) parts.push(createElement(Fragment, { key: `t${i}` }, text.slice(at, l.start)));
    parts.push(
      createElement(
        "a",
        {
          key: `a${i}`,
          className: "fd-ext",
          href: l.url,
          target: "_blank",
          rel: "nofollow noopener noreferrer ugc",
          onClick: (e) => e.stopPropagation(),
        },
        shown(l.url)
      )
    );
    at = l.end;
  });
  if (at < text.length) parts.push(createElement(Fragment, { key: "end" }, text.slice(at)));
  return parts;
}