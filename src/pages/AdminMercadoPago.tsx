/**
 * Panel de Configuración de MercadoPago
 * 
 * Permite configurar credenciales, URLs de webhook y URLs de retorno
 * Con estilo Liquid Glass UI
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  CreditCard, 
  Key, 
  Globe, 
  Webhook, 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Save,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin;

// URLs de panel de desarrolladores por país
const MP_DEVELOPER_URLS: Record<string, string> = {
  MX: "https://www.mercadopago.com.mx/developers/panel/credentials",
  AR: "https://www.mercadopago.com.ar/developers/panel/credentials",
  BR: "https://www.mercadopago.com.br/developers/panel/credentials",
  CL: "https://www.mercadopago.cl/developers/panel/credentials",
  CO: "https://www.mercadopago.com.co/developers/panel/credentials",
  PE: "https://www.mercadopago.com.pe/developers/panel/credentials",
  UY: "https://www.mercadopago.com.uy/developers/panel/credentials",
};

interface MercadoPagoConfig {
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
  webhookUrl: string;
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  country: string;
  currency: string;
  configured: boolean;
  testMode: boolean;
}

async function fetchMPConfig(): Promise<MercadoPagoConfig> {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/payments/admin/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar configuración");
  const data = await response.json();
  return data.config;
}

async function updateMPConfig(config: Partial<MercadoPagoConfig>) {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/payments/admin/config`, {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}` 
    },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error("Error al guardar");
  return response.json();
}

export function AdminMercadoPago() {
  const queryClient = useQueryClient();
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    accessToken: "",
    publicKey: "",
    webhookSecret: "",
    webhookUrl: "",
    successUrl: "",
    failureUrl: "",
    pendingUrl: "",
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ["mp-admin-config"],
    queryFn: fetchMPConfig,
  });

  const saveMutation = useMutation({
    mutationFn: updateMPConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mp-admin-config"] });
      setHasChanges(false);
      toast.success("Configuración de MercadoPago guardada");
    },
    onError: () => {
      toast.error("Error al guardar configuración");
    },
  });

  useEffect(() => {
    if (config) {
      setFormData({
        accessToken: "", // No pre-llenamos el token por seguridad
        publicKey: config.publicKey || "",
        webhookSecret: "",
        webhookUrl: config.webhookUrl || "",
        successUrl: config.backUrls?.success || "",
        failureUrl: config.backUrls?.failure || "",
        pendingUrl: config.backUrls?.pending || "",
      });
    }
  }, [config]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Solo enviar campos que tienen valor
    const updates: Record<string, string> = {};
    if (formData.accessToken) updates.accessToken = formData.accessToken;
    if (formData.publicKey) updates.publicKey = formData.publicKey;
    if (formData.webhookSecret) updates.webhookSecret = formData.webhookSecret;
    if (formData.webhookUrl) updates.webhookUrl = formData.webhookUrl;
    if (formData.successUrl) updates.successUrl = formData.successUrl;
    if (formData.failureUrl) updates.failureUrl = formData.failureUrl;
    if (formData.pendingUrl) updates.pendingUrl = formData.pendingUrl;
    
    saveMutation.mutate(updates);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success(`${label} copiado al portapapeles`);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
      </div>
    );
  }

  const webhookEndpoint = `${API_BASE_URL}/api/payments/webhook`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cn(
        "relative overflow-hidden rounded-[32px] px-8 py-8",
        "bg-gradient-to-br from-white/10 via-white/5 to-transparent",
        "border border-white/15 backdrop-blur-xl",
        "shadow-[0_25px_80px_rgba(15,23,42,0.7)]"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-gold-500/20 to-amber-500/20 p-4">
              <CreditCard className="h-8 w-8 text-gold-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">MercadoPago</h1>
              <p className="text-white/60">Configuración de la pasarela de pagos</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {config?.configured ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Configurado
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                <AlertCircle className="mr-1 h-3 w-3" />
                No configurado
              </Badge>
            )}
            
            {config?.testMode ? (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                Modo Prueba
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                Producción
              </Badge>
            )}
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              className="border-white/20 bg-white/5 hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Efecto de brillo */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Credenciales */}
        <Card className="border-white/10 bg-[#0a0a0a]/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Key className="h-5 w-5 text-gold-400" />
              Credenciales API
            </CardTitle>
            <CardDescription>
              Obtén tus credenciales en{" "}
              <a 
                href={MP_DEVELOPER_URLS[config?.country || "MX"] || MP_DEVELOPER_URLS.MX}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gold-400 hover:underline inline-flex items-center gap-1"
              >
                Panel de Desarrolladores
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Access Token */}
            <div className="space-y-2">
              <Label className="text-white/70">Access Token</Label>
              <div className="relative">
                <Input
                  type={showAccessToken ? "text" : "password"}
                  placeholder={config?.accessToken || "APP_USR-xxxx..."}
                  value={formData.accessToken}
                  onChange={(e) => handleChange("accessToken", e.target.value)}
                  className="border-white/10 bg-white/5 pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                >
                  {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-white/50">
                Token privado para procesar pagos. Nunca lo compartas.
              </p>
            </div>

            {/* Public Key */}
            <div className="space-y-2">
              <Label className="text-white/70">Public Key</Label>
              <Input
                type="text"
                placeholder="APP_USR-xxxx..."
                value={formData.publicKey}
                onChange={(e) => handleChange("publicKey", e.target.value)}
                className="border-white/10 bg-white/5 font-mono text-sm"
              />
              <p className="text-xs text-white/50">
                Clave pública para el SDK de JavaScript.
              </p>
            </div>

            <Separator className="bg-white/10" />

            {/* Webhook Secret */}
            <div className="space-y-2">
              <Label className="text-white/70">Webhook Secret (Opcional)</Label>
              <div className="relative">
                <Input
                  type={showWebhookSecret ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.webhookSecret}
                  onChange={(e) => handleChange("webhookSecret", e.target.value)}
                  className="border-white/10 bg-white/5 pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                >
                  {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-white/50">
                Para validar notificaciones de webhook.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Webhook */}
        <Card className="border-white/10 bg-[#0a0a0a]/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Webhook className="h-5 w-5 text-amber-400" />
              Webhook IPN
            </CardTitle>
            <CardDescription>
              Configura esta URL en tu panel de MercadoPago
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* URL del Webhook */}
            <div className="space-y-2">
              <Label className="text-white/70">URL de Notificación</Label>
              <div className="flex gap-2">
                <Input
                  value={webhookEndpoint}
                  readOnly
                  className="border-white/10 bg-white/5 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookEndpoint, "URL")}
                  className="border-white/20 bg-white/5 hover:bg-white/10 flex-shrink-0"
                >
                  {copied === "URL" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-white/50">
                Copia esta URL y configúrala en MercadoPago → Webhooks → Notificaciones IPN
              </p>
            </div>

            <div className="rounded-xl bg-gold-500/10 border border-gold-500/30 p-4">
              <h4 className="font-medium text-gold-300 mb-2">Eventos a suscribir:</h4>
              <ul className="text-sm text-gold-200/70 space-y-1">
                <li>• payment.created</li>
                <li>• payment.updated</li>
                <li>• merchant_order (opcional)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* URLs de Retorno */}
        <Card className="border-white/10 bg-[#0a0a0a]/60 backdrop-blur-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Globe className="h-5 w-5 text-emerald-400" />
              URLs de Retorno
            </CardTitle>
            <CardDescription>
              Páginas a las que el usuario será redirigido después del pago
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-white/70 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Pago Exitoso
                </Label>
                <Input
                  type="url"
                  placeholder={`${APP_URL}/payment/success`}
                  value={formData.successUrl}
                  onChange={(e) => handleChange("successUrl", e.target.value)}
                  className="border-white/10 bg-white/5"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  Pago Fallido
                </Label>
                <Input
                  type="url"
                  placeholder={`${APP_URL}/payment/failure`}
                  value={formData.failureUrl}
                  onChange={(e) => handleChange("failureUrl", e.target.value)}
                  className="border-white/10 bg-white/5"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-amber-400" />
                  Pago Pendiente
                </Label>
                <Input
                  type="url"
                  placeholder={`${APP_URL}/payment/pending`}
                  value={formData.pendingUrl}
                  onChange={(e) => handleChange("pendingUrl", e.target.value)}
                  className="border-white/10 bg-white/5"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información y Seguridad */}
        <Card className="border-white/10 bg-[#0a0a0a]/60 backdrop-blur-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="h-5 w-5 text-amber-400" />
              Información de Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
                <h4 className="font-medium text-amber-300 mb-2">Modo de Prueba</h4>
                <p className="text-sm text-amber-200/70">
                  Usa credenciales de prueba (TEST-xxx) para desarrollo. Los pagos no serán reales.
                </p>
              </div>
              
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
                <h4 className="font-medium text-emerald-300 mb-2">Modo Producción</h4>
                <p className="text-sm text-emerald-200/70">
                  Usa credenciales de producción (APP_USR-xxx) para pagos reales. Verifica tu cuenta primero.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
              <h4 className="font-medium text-amber-300 mb-2">Tarjetas de Prueba</h4>
              <div className="grid gap-2 md:grid-cols-3 text-sm text-amber-200/70 font-mono">
                <div>
                  <p className="text-amber-300">Visa (aprobado):</p>
                  <p>4509 9535 6623 3704</p>
                </div>
                <div>
                  <p className="text-amber-300">Mastercard (aprobado):</p>
                  <p>5031 7557 3453 0604</p>
                </div>
                <div>
                  <p className="text-amber-300">CVV / Vencimiento:</p>
                  <p>123 / 11/25</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botón de guardar flotante */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            size="lg"
            className={cn(
              "h-14 px-6 text-lg font-semibold",
              "bg-gradient-to-r from-gold-500 to-amber-500",
              "hover:from-gold-400 hover:to-amber-400",
              "shadow-[0_10px_40px_rgba(6,182,212,0.4)]"
            )}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Guardar Configuración
          </Button>
        </div>
      )}
    </div>
  );
}

export default AdminMercadoPago;
