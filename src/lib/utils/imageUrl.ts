const PRODUCTION_URL = 'https://update.compratuboleto.mx';

/**
 * Normalizes image URLs to ensure HTTPS is used
 * Handles relative paths, HTTP URLs, localhost URLs, and ensures proper domain
 */
export const normalizeImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  
  // If it's a relative URL starting with /uploads, prepend the production URL
  if (url.startsWith('/uploads')) {
    return `${PRODUCTION_URL}${url}`;
  }
  
  // Handle localhost URLs - replace with production URL
  if (url.includes('localhost:') || url.includes('127.0.0.1:')) {
    try {
      const parsed = new URL(url);
      return `${PRODUCTION_URL}${parsed.pathname}`;
    } catch {
      // If parsing fails, try simple replacement
      return url.replace(/https?:\/\/(localhost|127\.0\.0\.1):\d+/, PRODUCTION_URL);
    }
  }
  
  // Force HTTPS for any http URLs
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  
  return url;
};

/**
 * Gets the full URL for an uploaded file
 */
export const getUploadUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return normalizeImageUrl(path);
  }
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${PRODUCTION_URL}${normalizedPath}`;
};
