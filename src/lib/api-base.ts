const isBrowser = typeof window !== "undefined";

const isPrivateHost = (hostname: string) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname.endsWith(".local") ||
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\/(1[6-9]|2\d|3[0-1])\./.test(hostname);

export const getApiBaseUrl = (): string => {
  const raw = import.meta.env.VITE_API_URL ?? "";
  if (!raw) return "";

  if (isBrowser && window.location.protocol === "https:" && raw.startsWith("http://")) {
    try {
      const url = new URL(raw);
      if (isPrivateHost(url.hostname)) {
        return window.location.origin;
      }
      return raw.replace(/^http:\/\//i, "https://");
    } catch {
      return raw.replace(/^http:\/\//i, "https://");
    }
  }

  return raw;
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Normaliza URLs de imágenes/recursos almacenados en la DB.
 * Convierte URLs de localhost a URLs relativas que funcionan en producción.
 * 
 * @param url - URL original (puede ser absoluta con localhost o relativa)
 * @returns URL normalizada para el contexto actual (dev o producción)
 */
export function normalizeAssetUrl(url: string | null | undefined): string {
  if (!url) return "";
  
  // Si ya es una URL relativa, agregarle el base
  if (url.startsWith("/uploads/")) {
    return `${API_BASE_URL}${url}`;
  }
  
  // Si tiene localhost:4000, extraer la parte relativa
  if (url.includes("localhost:4000")) {
    const path = url.replace(/^https?:\/\/localhost:4000/, "");
    return `${API_BASE_URL}${path}`;
  }
  
  // Si es una URL http en página https, intentar convertir
  if (isBrowser && window.location.protocol === "https:" && url.startsWith("http://")) {
    try {
      const parsed = new URL(url);
      if (isPrivateHost(parsed.hostname)) {
        // Es localhost o IP local, usar origin actual
        return `${window.location.origin}${parsed.pathname}`;
      }
      // Otro servidor HTTP, convertir a HTTPS
      return url.replace(/^http:\/\//i, "https://");
    } catch {
      return url;
    }
  }
  
  return url;
}
