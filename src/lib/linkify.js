// src/lib/linkify.js
// Turns post and reply text into safe, readable text:
//  - web addresses (only http:// and https://) become tappable links that open in a new tab with
//    rel="nofollow noopener noreferrer ugc"; the shown text drops "https://" and is shortened when very long
//  - **bold**, *italic* and `code` are shown as formatting (the stars and backticks disappear)
//  - everything else stays plain text (line breaks are kept by the .fd-text style)
// Formatting is deliberately strict so maths stays safe: "2*3*4" and "a * b" are NOT turned into italics, because
// an italic or bold mark must start after a space, a line start or punctuation, and hug the words inside it.
import { createElement } from "react";

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

// ---- formatting marks -------------------------------------------------------------------------------------------
// (no look-behind on purpose: older iPhones cannot even load a file that contains one)
const CODE_RE = /`([^`\n]+)`/;
const BOLD_RE = /(^|[^\w*])\*\*(\S(?:[^\n]*?\S)?)\*\*(?![\w*])/;
const ITALIC_RE = /(^|[^\w*])\*([^\s*](?:[^*\n]*?[^\s*])?)\*(?![\w*])/;

// The first link or formatted piece at or after `from`. Returns { type, start, end, inner, url?, mark? } or null.
function nextToken(text, from, links) {
  const rest = text.slice(from);
  let best = null;
  const take = (t) => {
    if (!best || t.start < best.start) best = t;
  };
  const link = links.find((l) => l.start >= from);
  if (link) take({ type: "link", start: link.start, end: link.end, url: link.url });
  let m = CODE_RE.exec(rest);
  if (m) take({ type: "code", start: from + m.index, end: from + m.index + m[0].length, inner: m[1], mark: "`" });
  m = BOLD_RE.exec(rest);
  if (m) {
    const s = from + m.index + m[1].length;
    take({ type: "bold", start: s, end: from + m.index + m[0].length, inner: m[2], mark: "**" });
  }
  m = ITALIC_RE.exec(rest);
  if (m) {
    const s = from + m.index + m[1].length;
    take({ type: "italic", start: s, end: from + m.index + m[0].length, inner: m[2], mark: "*" });
  }
  return best;
}

// Top-level pieces of the text, in order: [{ type, start, end, ... }]
function tokens(text) {
  const links = findLinks(text);
  const out = [];
  let at = 0;
  while (at < text.length) {
    const t = nextToken(text, at, links);
    if (!t) break;
    out.push(t);
    at = t.end;
  }
  return out;
}

const CODE_STYLE = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  fontSize: "0.92em",
  background: "rgba(127, 127, 127, 0.18)",
  padding: "1px 5px",
  borderRadius: "6px",
};

// Cut a long text for "Show more" without ever cutting an address or a formatted piece in half.
// Shortens to `max` characters and, when given, `maxLines` lines (blank lines count).
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
  let close = "";
  for (const t of tokens(text)) {
    if (cut > t.start && cut < t.end) {
      if (t.type === "link" || t.start >= 20) {
        cut = t.start; // stop just before the address / formatted piece
      } else {
        close = t.mark; // a long piece right at the start: keep it and close it so the stars never show
      }
      break;
    }
  }
  return `${text.slice(0, cut).trimEnd()}${close}…`;
}

function renderInline(text, base) {
  const links = findLinks(text);
  const out = [];
  let at = 0;
  let n = 0;
  while (at < text.length) {
    const t = nextToken(text, at, links);
    if (!t) break;
    if (t.start > at) out.push(text.slice(at, t.start));
    const key = `${base}${n++}`;
    if (t.type === "link") {
      out.push(
        createElement(
          "a",
          {
            key,
            className: "fd-ext",
            href: t.url,
            target: "_blank",
            rel: "nofollow noopener noreferrer ugc",
            onClick: (e) => e.stopPropagation(),
          },
          shown(t.url)
        )
      );
    } else if (t.type === "code") {
      out.push(createElement("code", { key, style: CODE_STYLE }, t.inner));
    } else {
      out.push(createElement(t.type === "bold" ? "strong" : "em", { key }, renderInline(t.inner, `${key}.`)));
    }
    at = t.end;
  }
  if (!out.length) return text;
  if (at < text.length) out.push(text.slice(at));
  return out;
}

export default function LinkedText({ text }) {
  if (!text) return text;
  return renderInline(text, "k");
}