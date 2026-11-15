// src/lib/iap.js
import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

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

async function activateUnlimited(uid) {
  await updateDoc(doc(db, "users", uid), {
    plan: "unlimited",
    subscriptionStatus: "active",
    subscriptionSource: Capacitor.getPlatform(),
    updatedAt: serverTimestamp(),
  });
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
  await activateUnlimited(uid);
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
  await activateUnlimited(uid);
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