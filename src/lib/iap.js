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

async function getPurchases() {
  // Static import above (RevenueCat recommends it). If the native plugin was not
  // built into the app, say so clearly instead of hanging.
  if (!Capacitor.isPluginAvailable("Purchases")) {
    throw new Error(
      "Store plugin is missing from this build (step 1 of 3: native RevenueCat code was not included). Run npx cap sync ios and rebuild."
    );
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

function setupTimeoutMessage() {
  const k = nativeKey();
  let plugin = "?";
  try {
    plugin = String(Capacitor.isPluginAvailable("Purchases"));
  } catch (e) {
    plugin = "err";
  }
  return (
    "Store setup timed out (step 1 of 3: RevenueCat did not start). Check the RevenueCat key in the build. " +
    "[v4 plugin=" + plugin + " key=" + k.slice(0, 5) + " len=" + k.length + "]"
  );
}
const OFFERINGS_TIMEOUT_MESSAGE =
  "Store products timed out (step 2 of 3: the App Store did not return the subscription). Check the product and the RevenueCat offering.";

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
    const Purchases = await getPurchases();
    if (!sdkStarted) {
      // Start with the key only (RevenueCat's documented flow), then log the user in
      await Purchases.configure({ apiKey: nativeKey() });
      sdkStarted = true;
    }
    await Purchases.logIn({ appUserID: uid });
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
  if (!uid) throw new Error("Sign in first");
  if (!iapConfigured()) {
    throw new Error("Store billing is not configured yet. Add RevenueCat keys.");
  }

  await withTimeout(initIAP(uid), 15000, setupTimeoutMessage());
  const Purchases = await getPurchases();
  const offerings = await withTimeout(Purchases.getOfferings(), 20000, OFFERINGS_TIMEOUT_MESSAGE);
  const pkg =
    offerings.current?.availablePackages?.find((p) =>
      (p.product?.identifier || "").includes("unlimited")
    ) || offerings.current?.monthly || offerings.current?.availablePackages?.[0];

  if (!pkg) throw new Error("No store product found. Create the subscription in App Store / Play.");

  let customerInfo;
  try {
    ({ customerInfo } = await Purchases.purchasePackage({ aPackage: pkg }));
  } catch (err) {
    // The person closed the Apple payment sheet: not an error
    if (err?.userCancelled) return false;
    throw new Error(`Purchase failed (step 3 of 3): ${err?.message || err}`);
  }
  if (!hasUnlimited(customerInfo)) {
    throw new Error("Purchase finished but Unlimited is not active yet.");
  }
  await activateUnlimited(uid);
  return true;
}

export async function restoreUnlimited(uid) {
  if (!uid) throw new Error("Sign in first");
  if (!iapConfigured()) throw new Error("Store billing is not configured yet.");
  await initIAP(uid);
  const Purchases = await getPurchases();
  const { customerInfo } = await Purchases.restorePurchases();
  if (!hasUnlimited(customerInfo)) {
    throw new Error("No active store subscription found for this Apple / Google account.");
  }
  await activateUnlimited(uid);
  return true;
}

// Price of the Unlimited plan exactly as the store shows it (local currency), e.g. "$9.99"
export async function getUnlimitedPrice(uid) {
  if (!uid || !iapConfigured()) return "";
  await withTimeout(initIAP(uid), 15000, setupTimeoutMessage());
  const Purchases = await getPurchases();
  const offerings = await withTimeout(Purchases.getOfferings(), 20000, OFFERINGS_TIMEOUT_MESSAGE);
  const pkg =
    offerings.current?.availablePackages?.find((p) =>
      (p.product?.identifier || "").includes("unlimited")
    ) || offerings.current?.monthly || offerings.current?.availablePackages?.[0];
  return pkg?.product?.priceString || "";
}