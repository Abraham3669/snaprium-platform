// src/lib/visits.js
// Counts who visits the site. One small record per visitor per page per browser session.
// Visitors are anonymous (a random id kept in the browser); signed-in people also carry their uid.
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "../context/AuthContext";

const OWNER_UIDS = ["csFXC9p3lLcmzmyP2YjFT42yMSw1"];
const VID_KEY = "snaprium_vid";
const SEEN_KEY = "snaprium_visit_paths";
const REF_KEY = "snaprium_visit_ref";
const GEO_KEY = "snaprium_visit_country";

function safe(fn, fallback = "") {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function visitorId() {
  let id = safe(() => localStorage.getItem(VID_KEY));
  if (!id) {
    id = (crypto?.randomUUID?.() || `${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/-/g, "").slice(0, 32);
    safe(() => localStorage.setItem(VID_KEY, id));
  }
  return id;
}

// Where this visit came from: ?ref= or ?utm_source= (put it in your outreach links), else the site that sent them.
function sourceOfVisit() {
  const saved = safe(() => sessionStorage.getItem(REF_KEY));
  if (saved !== null && saved !== "") return saved;
  const q = new URLSearchParams(window.location.search);
  let ref = (q.get("ref") || q.get("utm_source") || "").toLowerCase().trim();
  if (!ref) {
    const host = safe(() => (document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""));
    if (host && host !== window.location.hostname.replace(/^www\./, "")) ref = host;
  }
  ref = ref.slice(0, 80);
  safe(() => sessionStorage.setItem(REF_KEY, ref || "direct"));
  return ref || "direct";
}

function platformName() {
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.()) return "app";
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "") ? "phone" : "pc";
}

// Country comes from a free lookup (no server function of ours). If every lookup fails the visit is simply saved without one.
async function lookup(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("bad");
  return res;
}

async function countryCode() {
  const saved = safe(() => sessionStorage.getItem(GEO_KEY));
  if (saved !== null && saved !== "") return saved === "-" ? "" : saved;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 3000);
  let code = "";
  try {
    const text = await (await lookup("https://www.cloudflare.com/cdn-cgi/trace", ctl.signal)).text();
    code = (text.match(/^loc=([A-Z]{2})$/m) || [])[1] || "";
  } catch {
    try {
      code = String((await (await lookup("https://api.country.is/", ctl.signal)).json())?.country || "").toUpperCase();
    } catch {
      code = "";
    }
  }
  clearTimeout(t);
  code = /^[A-Z]{2}$/.test(code) ? code : "";
  safe(() => sessionStorage.setItem(GEO_KEY, code || "-"));
  return code;
}

export function trackVisit(path, uid = "") {
  if (typeof window === "undefined") return;
  if (uid && OWNER_UIDS.includes(uid)) return;
  const clean = String(path || "/").split("?")[0].split("#")[0].slice(0, 120) || "/";
  const seen = safe(() => JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]"), []);
  if (seen.includes(clean)) return;
  safe(() => sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen, clean].slice(-60))));
  const base = {
    vid: visitorId(),
    day: new Date().toISOString().slice(0, 10),
    path: clean,
    ref: sourceOfVisit(),
    platform: platformName(),
    uid: uid || "",
  };
  countryCode().then((country) => {
    addDoc(collection(db, "visits"), { ...base, country, ts: serverTimestamp() }).catch(() => {});
  });
}

// Put once inside the router (App.jsx): usePageVisits();
export function usePageVisits() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const uid = user?.uid || "";
  useEffect(() => {
    if (loading) return;
    trackVisit(pathname, uid);
  }, [pathname, uid, loading]);
}