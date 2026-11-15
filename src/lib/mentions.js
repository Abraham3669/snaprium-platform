// src/lib/mentions.js
//
// @mentions, shared by the chat boards and the Questions board so both behave the same.
//
//  handleOf(name)                    "Kofi O'Neil" -> "KofiONeil" (what gets typed after the @)
//  resolveMentions(text, people)     the uids of the people an @mention in `text` points at
//  mentionSuggestions(query, ...)    the people to offer while someone types "@ko"

// Only letters, numbers, "_", "." and "-" can be typed in a handle. Everything else
// (spaces, apostrophes, brackets, emoji) is dropped, so every name can be mentioned.
export const handleOf = (name) =>
  String(name || "")
    .replace(/[^\p{L}\p{N}_.-]+/gu, "")
    .replace(/^[.-]+|[.-]+$/g, "");

const firstHandle = (name) => handleOf(String(name || "").trim().split(/\s+/)[0]);

// people = [{ uid, name }]
export function resolveMentions(text, people) {
  const found = new Set();
  const re = /@([\p{L}\p{N}_.-]{2,})/gu;
  let m;
  while ((m = re.exec(text || ""))) {
    const token = m[1].replace(/[.-]+$/, "").toLowerCase();
    if (token.length < 2) continue;

    // 1. the full handle, the way the list inserts it
    const full = people.filter((p) => handleOf(p.name).toLowerCase() === token);
    if (full.length) {
      full.forEach((p) => found.add(p.uid));
      continue;
    }
    // 2. just the first name, but only when it is one person (never ping two people by guessing)
    const first = people.filter((p) => firstHandle(p.name).toLowerCase() === token);
    if (first.length === 1) {
      found.add(first[0].uid);
      continue;
    }
    if (first.length > 1) continue;
    // 3. the start of a name, again only when it is one person
    const prefix = people.filter((p) => handleOf(p.name).toLowerCase().startsWith(token));
    if (prefix.length === 1) found.add(prefix[0].uid);
  }
  return [...found];
}

// recent = { [uid]: number } where a bigger number means they spoke more recently
export function mentionSuggestions(query, people, selfUid, recent = {}, max = 8) {
  if (query === null || query === undefined) return [];
  const q = String(query).toLowerCase();
  return people
    .filter((p) => p.uid !== selfUid && handleOf(p.name))
    .filter(
      (p) =>
        handleOf(p.name).toLowerCase().startsWith(q) ||
        String(p.name)
          .toLowerCase()
          .split(/\s+/)
          .some((w) => handleOf(w).toLowerCase().startsWith(q))
    )
    .sort((a, b) => (recent[b.uid] || 0) - (recent[a.uid] || 0) || String(a.name).localeCompare(String(b.name)))
    .slice(0, max);
}

// "@everyone" / "@all" ping the whole circle (circle admins only, enforced on the server too).
export const EVERYONE_RE = /(^|\s)@(everyone|all)(?![\p{L}\p{N}_])/iu;
export const hasEveryone = (text) => EVERYONE_RE.test(String(text || ""));
export const EVERYONE_ENTRY = { uid: "__everyone", name: "everyone", special: true };