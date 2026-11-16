// src/lib/iap.js
import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";
import { auth } from "./firebase";

export const IAP_PRODUCT_ID = "snaprium_unlimited_monthly";
export const IAP_ENTITLEMENT = "unlimited";

function nativeKey() {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return import.meta.env.VITE_REVENUECAT_IOS_KEY || "";
  if (platform === "android") return import.meta.env.VITE_REVENUECAT_ANDROID_KEY || "";
  return "";
}

export function iapConfigured() {
  return Capacitor.isNativePlatform() && Boolean(nativeKey());
}

// IMPORTANT: this must stay a normal (non-async) function and must never be awaited.
// The plugin object behaves like a 'thenable'; awaiting or returning it from an
// async function makes JavaScript call .then() on it, and the call never finishes.
function getPurchases() {
  // Static import above (RevenueCat recommends it). If the native plugin was not
  // built into the app, say so clearly instead of hanging.
  if (!Capacitor.isPluginAvailable("Purchases")) {
    console.error("[iap] RevenueCat native plugin is not available in this build");
    throw new Error("Purchases are not available right now. Please try again later.");
  }
  return Purchases;
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const STORE_TIMEOUT_MESSAGE =
  "The store is taking too long to respond. Please check your connection and try again.";

let configuredUid = null;
let sdkStarted = false;
let initPromise = null;
let initPromiseUid = null;

// Safe to call many times at once: the store is set up only once per user
export function initIAP(uid) {
  if (!iapConfigured() || !uid) return Promise.resolve(false);
  if (configuredUid === uid) return Promise.resolve(true);
  if (initPromise && initPromiseUid === uid) return initPromise;

  initPromiseUid = uid;
  initPromise = (async () => {
    const Purchases = getPurchases();
    if (!sdkStarted) {
      // Start with the key only (RevenueCat's documented flow), then log the user in
      await withTimeout(
        Purchases.configure({ apiKey: nativeKey() }),
        8000,
        STORE_TIMEOUT_MESSAGE
      );
      sdkStarted = true;
    }
    try {
      await withTimeout(
        Purchases.logIn({ appUserID: uid }),
        8000,
        STORE_TIMEOUT_MESSAGE
      );
    } catch (e) {
      // Not fatal: continue so the next step can show its own error
      console.warn("[iap] logIn did not complete", e);
    }
    configuredUid = uid;
    return true;
  })().finally(() => {
    initPromise = null;
    initPromiseUid = null;
  });
  return initPromise;
}

function apiBase() {
  return (import.meta.env.VITE_API_URL || "https://snaprium.com").replace(/\/$/, "");
}

// Asks OUR SERVER to check the subscription with RevenueCat and update the plan.
// The phone never writes the plan itself, so nobody can give themselves a paid plan.
async function callBillingSync() {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in first.");
  const idToken = await user.getIdToken();
  const res = await fetch(`${apiBase()}/api/daily-room`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action: "billing:sync" }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || "Could not check your subscription right now.");
  return json;
}

// Right after a purchase / restore. RevenueCat can take a moment to catch up, so try a few times.
async function activateUnlimited() {
  let last = null;
  for (let i = 0; i < 4; i += 1) {
    last = await callBillingSync();
    if (last.active) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Your purchase went through, but your plan is still updating. Please wait a moment, then tap Restore purchases.");
}

// Quiet check when the app or Profile opens: picks up renewals, cancellations and refunds.
// Runs at most once every 5 minutes and never shows an error.
let lastQuietSync = 0;
export async function syncSubscriptionQuietly() {
  if (!Capacitor.isNativePlatform()) return;
  if (Date.now() - lastQuietSync < 5 * 60 * 1000) return;
  lastQuietSync = Date.now();
  try {
    await callBillingSync();
  } catch (err) {
    console.debug("[iap] quiet sync skipped", err?.message || err);
  }
}

function hasUnlimited(customerInfo) {
  return Boolean(customerInfo?.entitlements?.active?.[IAP_ENTITLEMENT]);
}

export async function purchaseUnlimited(uid) {
  if (!uid) throw new Error("Please sign in first.");
  if (!iapConfigured()) {
    throw new Error("Purchases are not available right now. Please try again later.");
  }

  await withTimeout(initIAP(uid), 15000, STORE_TIMEOUT_MESSAGE);
  const Purchases = getPurchases();
  const offerings = await withTimeout(Purchases.getOfferings(), 20000, STORE_TIMEOUT_MESSAGE);
  const pkg =
    offerings.current?.availablePackages?.find((p) =>
      (p.product?.identifier || "").includes("unlimited")
    ) || offerings.current?.monthly || offerings.current?.availablePackages?.[0];

  if (!pkg) throw new Error("The subscription is not available right now. Please try again later.");

  let customerInfo;
  try {
    ({ customerInfo } = await Purchases.purchasePackage({ aPackage: pkg }));
  } catch (err) {
    // The person closed the Apple payment sheet: not an error
    if (err?.userCancelled) return false;
    console.error("[iap] purchase failed", err);
    throw new Error("The purchase could not be completed. Please try again.");
  }
  if (!hasUnlimited(customerInfo)) {
    throw new Error("Your purchase went through, but your plan is still updating. Please wait a moment, then tap Restore purchases.");
  }
  await activateUnlimited();
  return true;
}

export async function restoreUnlimited(uid) {
  if (!uid) throw new Error("Please sign in first.");
  if (!iapConfigured()) throw new Error("Purchases are not available right now. Please try again later.");
  await initIAP(uid);
  const Purchases = getPurchases();
  const { customerInfo } = await Purchases.restorePurchases();
  if (!hasUnlimited(customerInfo)) {
    throw new Error(
      Capacitor.getPlatform() === "ios"
        ? "No active subscription was found for this Apple ID."
        : "No active subscription was found for this Google account."
    );
  }
  await activateUnlimited();
  return true;
}

// Price of the Unlimited plan exactly as the store shows it (local currency), e.g. "$9.99"
export async function getUnlimitedPrice(uid) {
  if (!uid || !iapConfigured()) return "";
  await withTimeout(initIAP(uid), 15000, STORE_TIMEOUT_MESSAGE);
  const Purchases = getPurchases();
  const offerings = await withTimeout(Purchases.getOfferings(), 20000, STORE_TIMEOUT_MESSAGE);
  const pkg =
    offerings.current?.availablePackages?.find((p) =>
      (p.product?.identifier || "").includes("unlimited")
    ) || offerings.current?.monthly || offerings.current?.availablePackages?.[0];
  return pkg?.product?.priceString || "";
}