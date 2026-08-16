import { Capacitor } from '@capacitor/core';

const PRODUCTION_API_URL = "https://snaprium.com";

const API_BASE = Capacitor.isNativePlatform()
  ? PRODUCTION_API_URL
  : (import.meta.env.VITE_API_URL || "");

export async function postAPI(url, data) {
  const fullUrl = `${API_BASE}${url}`;
  
  console.log("[apiClient] Calling:", fullUrl);

  const res = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("[apiClient] Error:", res.status, errorText);
    throw new Error(`API error: ${res.status} - ${errorText}`);
  }

  return await res.json();
}