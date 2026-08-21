import { Capacitor } from '@capacitor/core';
import { showAppError } from './errorReporter';

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
      throw new Error(`${res.status}: ${text.substring(0, 200)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON response from server");
    }
  } catch (err) {
    const online = navigator.onLine ? "online" : "OFFLINE";
    const platform = Capacitor.isNativePlatform() ? "native" : "web";
    const diagnostic = `url=${fullUrl} | platform=${platform} | net=${online} | ${err.name}: ${err.message}`;
    showAppError(`API ${url}`, new Error(diagnostic));
    throw err;
  }
}

export async function testConnectivity() {
  const testUrl = `${PRODUCTION_API_URL}/api/debug-origin`;
  try {
    const res = await fetch(testUrl);
    const data = await res.json();
    showAppError('Origin Debug', new Error(JSON.stringify(data)));
  } catch (err) {
    showAppError('Origin Debug', new Error(`${err.name}: ${err.message}`));
  }
}