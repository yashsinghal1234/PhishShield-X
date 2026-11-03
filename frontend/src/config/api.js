/**
 * Centralized API Base URL Configuration for PhishShield-X
 * - Automatically selects local backend when developing on localhost
 * - Automatically falls back to deployed Render backend when hosted on Vercel / Cloud
 */
export const getApiBaseUrl = () => {
  // If explicitly configured via Vite environment variable, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }

  // If running in browser on localhost or local network IP, connect to local dev server
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }

  // In production (Vercel, Netlify, or any online domain), route to the live Render cloud backend
  return 'https://phishshield-x.onrender.com';
};

export const API_BASE_URL = getApiBaseUrl();
