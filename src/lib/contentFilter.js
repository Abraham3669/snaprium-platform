// src/lib/contentFilter.js
//
// A simple text filter for messages, questions, replies and edits (App Store Guideline 1.2).
// It blocks slurs, explicit sexual words, strong abuse and direct threats. It matches WHOLE words only,
// so normal words that happen to contain a bad one (class, assess, Scunthorpe) are never blocked, and
// study words (sex, kill, breast...) are left alone. It also sees through common disguises:
// capital letters, accents, f.u.c.k, f u c k, fuuuck, sh1t, $hit.
//
// It cannot catch everything. Reports and your Admin page cover the rest.

export const FILTER_MESSAGE = "That breaks the community rules. Please reword it.";

// Plain words (suffixes like s / ing / er are handled). Spaces inside an entry mean "a gap of any size".
const WORDS = [
  // abuse and profanity
  "fuck", "fucker", "motherfucker", "shit", "bullshit", "shitty", "bitch", "asshole", "dumbass",
  "dickhead", "cunt", "whore", "slut", "twat", "wanker", "prick",
  // slurs
  "nigger", "nigga", "faggot", "tranny", "kike", "spic", "chink", "gook", "wetback", "paki",
  // explicit sexual
  "porn", "pornhub", "hentai", "blowjob", "handjob", "cumshot", "dildo", "nudes", "jerk off", "jack off",
  // sexual propositions (the plain word "sex" stays allowed for biology and health questions)
  "sex with me", "sex with you", "sex with us", "wanna have sex", "want to have sex", "wanna sex", "dick pic", "send nude", "sext",
  // threats and self-harm baiting
  "kys", "kill yourself", "kill urself", "hang yourself", "i will kill you", "i ll kill you", "ill kill you",
  "i will find you and", "i hope you die",
];

// Words that only count in their plain or plural form (so "retarded potential" in physics is fine)
const EXACT = ["retard"];

const SUFFIX = "(?:s|es|ed|er|ers|ing|in|y)?";
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" };

// "ass" -> a+ s{2,}   (so the single word "as" is never caught)
function letters(word) {
  const runs = word.match(/(.)\1*/g) || [];
  return runs.map((r) => (r.length === 1 ? `${r}+` : `${r[0]}{${r.length},}`)).join("");
}

const PATTERNS = WORDS.map((w) => {
  const body = w
    .split(" ")
    .map(letters)
    .join("\\s+");
  return new RegExp(`\\b${body}${SUFFIX}\\b`);
});

PATTERNS.push(...EXACT.map((w) => new RegExp(`\\b${letters(w)}s?\\b`)));

function normalize(input) {
  let t = String(input || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ​-‏⁠﻿]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, " ");
  // sh1t, $hit, a$$hole, fu!k : swap look-alike symbols only inside words that contain a letter
  t = t.replace(/[a-z0-9@$!]+/g, (tok) => {
    if (!/[a-z]/.test(tok)) return tok;
    return tok.replace(/^(!*)(.*?)(!*)$/, (_, a, b, c) => a + b.replace(/[0134 57@$!]/g, (ch) => (ch === "!" ? "i" : LEET[ch])) + c);
  });
  // f.u.c.k  /  f u c k  /  f_u_c_k
  t = t.replace(/\b(?:[a-z][\s.\-_*]+){2,}[a-z]\b/g, (m) => m.replace(/[\s.\-_*]+/g, ""));
  return t;
}

export function isClean(text) {
  const t = normalize(text);
  if (!t.trim()) return true;
  return !PATTERNS.some((re) => re.test(t));
}