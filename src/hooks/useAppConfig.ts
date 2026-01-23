/**
 * Hook para cargar configuración de la aplicación desde el backend
 * Reemplaza valores hardcodeados por configuración dinámica
 */

import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface AppConfig {
  appName: string;
  appDescription: string;
  appLogo: string;
  appLogoSize: number;
  primaryColor: string;
  currency: string;
  currencyLocale: string;
  maxTicketsPerPurchase: number;
  allowRegistration: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  appName: "compratuboleto.mx",
  appDescription: "Sistema de venta de boletos",
  appLogo: "",
  appLogoSize: 56,
  primaryColor: "#00d4ff",
  currency: "MXN",
  currencyLocale: "es-MX",
  maxTicketsPerPurchase: 10,
  allowRegistration: true,
};

async function fetchAppConfig(): Promise<AppConfig> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/settings/public`);
    if (!response.ok) {
      console.warn("[AppConfig] Failed to load config, using defaults");
      return DEFAULT_CONFIG;
    }
    
    const data = await response.json();
    const settings = data.settings || {};
    
    return {
      appName: settings["app.name"] || DEFAULT_CONFIG.appName,
      appDescription: settings["app.description"] || DEFAULT_CONFIG.appDescription,
      appLogo: settings["app.logo"] || DEFAULT_CONFIG.appLogo,
      appLogoSize: parseInt(settings["app.logoSize"]) || DEFAULT_CONFIG.appLogoSize,
      primaryColor: settings["app.primaryColor"] || DEFAULT_CONFIG.primaryColor,
      currency: settings["payments.currency"] || DEFAULT_CONFIG.currency,
      currencyLocale: getCurrencyLocale(settings["payments.currency"]),
      maxTicketsPerPurchase: parseInt(settings["tickets.maxPerPurchase"]) || DEFAULT_CONFIG.maxTicketsPerPurchase,
      allowRegistration: settings["security.allowRegistration"] !== "false",
    };
  } catch (err) {
    console.error("[AppConfig] Error fetching config:", err);
    return DEFAULT_CONFIG;
  }
}

// Mapeo de moneda a locale
function getCurrencyLocale(currency: string): string {
  const localeMap: Record<string, string> = {
    MXN: "es-MX",
    USD: "en-US",
    EUR: "es-ES",
    ARS: "es-AR",
    COP: "es-CO",
    CLP: "es-CL",
    PEN: "es-PE",
    BRL: "pt-BR",
  };
  return localeMap[currency] || "es-MX";
}

// Hook principal
export function useAppConfig() {
  const { data: config, isLoading, error } = useQuery({
    queryKey: ["app-config"],
    queryFn: fetchAppConfig,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });

  return {
    config: config || DEFAULT_CONFIG,
    isLoading,
    error,
  };
}

// Función helper para formatear precio
export function formatPrice(amount: number, currency: string = "MXN", locale?: string): string {
  const currencyLocale = locale || getCurrencyLocale(currency);
  return new Intl.NumberFormat(currencyLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Función helper para formatear fecha
export function formatDate(date: string | Date, locale: string = "es-MX", options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return new Date(date).toLocaleDateString(locale, options || defaultOptions);
}

// Obtener año actual (para copyright)
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export default useAppConfig;
