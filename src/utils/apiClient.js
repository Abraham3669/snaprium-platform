// src/utils/apiClient.js
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';  // '' = relative path = works both local + vercel

export async function apiFetch(endpoint, options = {}) {
  const url = `${BASE_URL}/api/${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Fetch error on ${endpoint}:`, error);
    throw error;
  }
}

// Example usage helpers
export const processImage = (data) => apiFetch('process', { method: 'POST', body: JSON.stringify(data) });
export const getHistory  = () => apiFetch('history');
export const login       = (credentials) => apiFetch('auth', { method: 'POST', body: JSON.stringify(credentials) });