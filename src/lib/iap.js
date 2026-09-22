// src/lib/iap.js
import { Capacitor } from "@capacitor/core";
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
  const mod = await import("@revenuecat/purchases-capacitor");
  return mod.Purchases;
}

export async function initIAP(uid) {
  if (!iapConfigured() || !uid) return false;
  const Purchases = await getPurchases();
  await Purchases.configure({
    apiKey: nativeKey(),
    appUserID: uid,
  });
  return true;
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

  await initIAP(uid);
  const Purchases = await getPurchases();
  const offerings = await Purchases.getOfferings();
  const pkg =
    offerings.current?.availablePackages?.find((p) =>
      (p.product?.identifier || "").includes("unlimited")
    ) || offerings.current?.monthly || offerings.current?.availablePackages?.[0];

  if (!pkg) throw new Error("No store product found. Create the subscription in App Store / Play.");

  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
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