import { API_BASE_URL } from '@/api/base44Client';

const apiBase = () => API_BASE_URL.replace(/\/$/, '');

/** Frontend origins that cannot serve uploaded files. */
const FRONTEND_ORIGINS = new Set([
  'http://localhost:5173',
  'https://siduravoda.onrender.com',
]);

/**
 * Ensure upload URLs always target the API server (or Vite proxy in dev).
 * Stored file_url values may point at the frontend origin or an old API host.
 */
export function resolveUploadUrl(fileUrl) {
  if (!fileUrl) return fileUrl;

  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    try {
      const url = new URL(fileUrl);
      if (!url.pathname.startsWith('/uploads/')) {
        return fileUrl;
      }

      // Remote production file while using a different API locally — keep original URL.
      if (url.origin !== apiBase() && !FRONTEND_ORIGINS.has(url.origin)) {
        return fileUrl;
      }

      if (import.meta.env.DEV) {
        return url.pathname;
      }

      return `${apiBase()}${url.pathname}`;
    } catch {
      return fileUrl;
    }
  }

  if (fileUrl.startsWith('/uploads/')) {
    if (import.meta.env.DEV) {
      return fileUrl;
    }
    return `${apiBase()}${fileUrl}`;
  }

  return fileUrl;
}
