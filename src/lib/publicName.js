// src/lib/publicName.js
// The name other people see (on posts, replies, profile cards and notifications).
// If someone never chose a name, the app falls back to the part of their email before the "@". That would show
// part of their email address in public, so in that case we show "Member" until they set a name in Profile.
export function publicName(user) {
  const name = String(user?.displayName || "").trim();
  const local = String(user?.email || "").split("@")[0].trim().toLowerCase();
  if (!name || (local && name.toLowerCase() === local) || name.includes("@")) return "Member";
  return name;
}