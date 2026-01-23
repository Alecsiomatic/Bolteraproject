/**
 * Normalizes image URLs to ensure HTTPS is used
 * Handles relative paths, HTTP URLs, and ensures proper domain
 */
export const normalizeImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  
  // If it's a relative URL starting with /uploads, prepend the API base
  if (url.startsWith('/uploads')) {
    return `https://update.compratuboleto.mx${url}`;
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
  return `https://update.compratuboleto.mx${normalizedPath}`;
};
