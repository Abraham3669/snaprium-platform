import { Capacitor } from '@capacitor/core';

const PRODUCTION_API_URL = "https://snaprium.com";

const API_BASE = Capacitor.isNativePlatform()
  ? PRODUCTION_API_URL
  : (import.meta.env.VITE_API_URL || "");

export async function postAPI(url, data) {
  const fullUrl = `${API_BASE}${url}`;
  
  console.log("[apiClient] Calling:", fullUrl);

  try {
    const res = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const text = await res.text();
    
    if (!res.ok) {
      console.error("[apiClient] Error status:", res.status, text);
      throw new Error(`API error ${res.status}: ${text.substring(0, 200)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON response from server");
    }
  } catch (err) {
    console.error("[apiClient] Fetch failed:", err);
    throw err;
  }
}