// src/lib/circleNav.js
//
// One place that decides where a circle tap goes, so every screen behaves the same:
//   member of the circle  ->  straight into its chat  (/community/<id>/chat)
//   not a member          ->  the preview page with the Join button (/community/<id>)
//   "Circles" tab / card  ->  the last circle you were in, else the Discover page (/community)
//
// Routes and notification links are NOT changed. Only where in-app taps go.
import { listMyCommunities } from "./communities";

const KEY = (uid) => `snaprium:lastCircle:${uid}`;

export function rememberCircle(uid, id) {
  if (!uid || !id) return;
  try {
    localStorage.setItem(KEY(uid), id);
  } catch {
    /* private mode: fine, the Circles tab just opens Discover */
  }
}

export function lastCircleId(uid) {
  if (!uid) return "";
  try {
    return localStorage.getItem(KEY(uid)) || "";
  } catch {
    return "";
  }
}

export function forgetCircle(uid, id) {
  if (!uid) return;
  try {
    if (!id || localStorage.getItem(KEY(uid)) === id) localStorage.removeItem(KEY(uid));
  } catch {
    /* ignore */
  }
}

// Chat of a circle (General opens by default).
export const circleChatPath = (id) => `/community/${id}/chat`;

// Preview / Join page of a circle.
export const circlePreviewPath = (id) => `/community/${id}`;

// Where tapping a circle card should go.
export function circleCardPath(circle, isMember) {
  return isMember ? circleChatPath(circle.id) : circlePreviewPath(circle.id);
}

// The "Circles" tab and the Home "Circles" card.
// Signed out -> Discover. Signed in -> last circle (or your first one) -> its chat. No circles -> Discover.
export async function openCircles(navigate, uid) {
  if (!uid) {
    navigate("/community");
    return;
  }
  const last = lastCircleId(uid);
  if (last) {
    navigate(circleChatPath(last));
    return;
  }
  try {
    const mine = await listMyCommunities(uid);
    if (mine && mine[0]) {
      navigate(circleChatPath(mine[0].id));
      return;
    }
  } catch {
    /* fall through to Discover */
  }
  navigate("/community");
}