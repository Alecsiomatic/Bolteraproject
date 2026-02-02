import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, Mail, Shield, Palette, Ticket, CreditCard, Save, Loader2, CheckCircle, Image, Eye, AlertCircle, Upload, X, Minus, Plus } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-base";

interface SettingItem {
  key: string;
  value: string;
  description: string;
  isDefault: boolean;
}

interface SettingsData {
  general: Record<string, SettingItem>;
  tickets: Record<string, SettingItem>;
  payments: Record<string, SettingItem>;
  email: Record<string, SettingItem>;
  security: Record<string, SettingItem>;
}

const fetchSettings = async (): Promise<SettingsData> => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar configuraciones");
  const data = await response.json();
  return data.settings;
};

const updateSettings = async (updates: Record<string, string>) => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/settings`, {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error("Error al guardar");
  return response.json();
};

const AdminSettings = () => {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoSize, setLogoSize] = useState(56); // Default h-14 = 56px
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: fetchSettings,
  });

  const saveMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      setHasChanges(false);
      toast.success("Configuración guardada");
    },
    onError: () => {
      toast.error("Error al guardar configuración");
    },
  });

  useEffect(() => {
    if (settings) {
      const initial: Record<string, string> = {};
      for (const category of Object.values(settings)) {
        for (const setting of Object.values(category as Record<string, SettingItem>)) {
          initial[setting.key] = setting.value;
        }
      }
      setLocalSettings(initial);
      // Load logo size from settings
      if (initial["app.logoSize"]) {
        setLogoSize(parseInt(initial["app.logoSize"]) || 56);
      }
    }
  }, [settings]);

  const updateLocal = (key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateLogoSize = (size: number) => {
    setLogoSize(size);
    updateLocal("app.logoSize", String(size));
    // Emit event for live preview in sidebar
    window.dispatchEvent(new CustomEvent('logoSizeChange', { detail: { size } }));
  };

  const updateLogoUrl = (url: string) => {
    updateLocal("app.logo", url);
    // Emit event for live preview in sidebar
    window.dispatchEvent(new CustomEvent('logoUrlChange', { detail: { url } }));
  };

  const getValue = (key: string) => localSettings[key] ?? "";
  const getBool = (key: string) => localSettings[key] === "true";

  const handleSave = () => {
    saveMutation.mutate(localSettings);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 px-2 py-4 text-white lg:px-0">
      <div className="flex items-center justify-between rounded-[32px] border border-white/10 bg-white/5 px-8 py-8 backdrop-blur-2xl">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-300">Configuración</p>
          <h1 className="mt-4 text-3xl font-semibold">Configuración del Sistema</h1>
          <p className="text-slate-300">Ajusta las preferencias globales de la plataforma</p>
        </div>
        {hasChanges && (
          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar todos los cambios
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Brand Identity - Full width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Identidad de Marca
            </CardTitle>
            <CardDescription>Personaliza el aspecto de tu boletera</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Logo Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Logo de la Empresa</Label>
                  <input 
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      setUploadingLogo(true);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        const token = localStorage.getItem('auth_token');
                        const response = await fetch(`${API_BASE_URL}/api/upload/misc`, {
                          method: 'POST',
                          headers: { 
                            'Authorization': `Bearer ${token}` 
                          },
                          body: formData
                        });
                        
                        if (!response.ok) throw new Error('Error al subir');
                        
                        const data = await response.json();
                        updateLogoUrl(data.url);
                      } catch (error) {
                        console.error('Error uploading logo:', error);
                      } finally {
                        setUploadingLogo(false);
                      }
                    }}
                  />
                  
                  {/* Upload Area */}
                  {!getValue("app.logo") ? (
                    <div 
                      onClick={() => logoInputRef.current?.click()}
                      className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/5 p-8 transition-all hover:border-gold-500/50 hover:bg-white/10"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-10 w-10 animate-spin text-gold-400" />
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-slate-400" />
                          <p className="mt-3 text-sm text-slate-300">
                            Haz clic para subir tu logo
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            PNG, JPG o SVG. Tamaño recomendado: 200x50px
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="relative rounded-xl border border-white/10 bg-slate-950 p-8">
                      <button
                        type="button"
                        onClick={() => updateLogoUrl("")}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1.5 text-white shadow-lg transition-colors hover:bg-red-600"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <div className="flex items-center justify-center">
                        <img 
                          src={getValue("app.logo")} 
                          alt="Logo"
                          className="max-h-32 max-w-[350px] object-contain"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        ) : (
                          "Cambiar logo"
                        )}
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Logo Preview in Navigation - Live Preview */}
                <div className="space-y-4">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Vista previa en tiempo real
                  </Label>
                  
                  {/* Size Control */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Tamaño del logo</span>
                      <span className="text-sm font-medium text-gold-400">{logoSize}px</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => updateLogoSize(Math.max(32, logoSize - 4))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <Slider
                        value={[logoSize]}
                        onValueChange={(v) => updateLogoSize(v[0])}
                        min={32}
                        max={80}
                        step={2}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => updateLogoSize(Math.min(80, logoSize + 4))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Live Navbar Preview */}
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    {/* Fake browser bar */}
                    <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900 px-3 py-2">
                      <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                        <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                      </div>
                      <div className="flex-1 rounded-md bg-slate-800 px-3 py-1 text-center text-xs text-slate-500">
                        compratuboleto.mx
                      </div>
                    </div>
                    
                    {/* Simulated Navbar - Glassmorphism style */}
                    <div className="relative bg-gradient-to-b from-purple-900/20 via-slate-900 to-slate-950 p-0">
                      <div className="border-b border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl">
                        <div className="flex h-16 items-center justify-between px-4">
                          {/* Logo */}
                          <div className="flex items-center gap-3">
                            {getValue("app.logo") ? (
                              <img 
                                src={getValue("app.logo")} 
                                alt="Logo preview"
                                style={{ height: `${logoSize}px`, maxWidth: '220px' }}
                                className="object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.15)] transition-all duration-200"
                              />
                            ) : (
                              <>
                                <div 
                                  className="flex items-center justify-center rounded-xl bg-gradient-to-br from-gold-500 to-amber-500"
                                  style={{ width: logoSize * 0.85, height: logoSize * 0.85 }}
                                >
                                  <Ticket className="text-white" style={{ width: logoSize * 0.4, height: logoSize * 0.4 }} />
                                </div>
                                <span className="text-lg font-bold text-white">
                                  {getValue("app.name") || "Boletera"}
                                </span>
                              </>
                            )}
                          </div>
                          
                          {/* Fake nav items */}
                          <div className="flex items-center gap-2">
                            <div className="rounded-lg px-3 py-1.5 text-xs text-white/60">Eventos</div>
                            <div className="rounded-lg px-3 py-1.5 text-xs text-white/60">Artistas</div>
                            <div className="rounded-lg px-3 py-1.5 text-xs text-white/60">Mi cuenta</div>
                            <div className="ml-2 rounded-lg border border-gold-500/30 bg-gold-500/10 px-3 py-1.5 text-xs text-gold-400">
                              Admin
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Content area simulation */}
                      <div className="h-24 bg-gradient-to-b from-transparent to-slate-950/50" />
                    </div>
                  </div>
                  
                  <p className="text-center text-xs text-slate-500">
                    Arrastra el control para ajustar el tamaño del logo
                  </p>
                </div>
              </div>

              {/* Brand Info Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="app.name">Nombre de la Aplicación</Label>
                  <Input 
                    id="app.name" 
                    value={getValue("app.name")}
                    onChange={e => updateLocal("app.name", e.target.value)}
                    placeholder="Mi Boletera"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app.description">Descripción / Slogan</Label>
                  <Input 
                    id="app.description" 
                    value={getValue("app.description")}
                    onChange={e => updateLocal("app.description", e.target.value)}
                    placeholder="Sistema de venta de boletos"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app.primaryColor">Color Principal</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="app.primaryColor" 
                      value={getValue("app.primaryColor")}
                      onChange={e => updateLocal("app.primaryColor", e.target.value)}
                      placeholder="#00d4ff"
                      className="flex-1"
                    />
                    <div 
                      className="h-10 w-10 rounded-lg border border-white/20"
                      style={{ backgroundColor: getValue("app.primaryColor") || "#00d4ff" }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    Color en formato hexadecimal (ej: #00d4ff)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Boletos
            </CardTitle>
            <CardDescription>Configuración de boletos y reservaciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tickets.reservationTimeout">Tiempo de reserva (segundos)</Label>
              <Input 
                id="tickets.reservationTimeout" 
                type="number"
                value={getValue("tickets.reservationTimeout")}
                onChange={e => updateLocal("tickets.reservationTimeout", e.target.value)}
              />
              <p className="text-xs text-slate-400">Tiempo para completar el pago (900 = 15 min)</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="tickets.maxPerPurchase">Máximo por compra</Label>
              <Input 
                id="tickets.maxPerPurchase" 
                type="number"
                value={getValue("tickets.maxPerPurchase")}
                onChange={e => updateLocal("tickets.maxPerPurchase", e.target.value)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Permitir transferencias</Label>
                <p className="text-sm text-slate-400">Los usuarios pueden transferir boletos</p>
              </div>
              <Switch 
                checked={getBool("tickets.allowTransfer")}
                onCheckedChange={v => updateLocal("tickets.allowTransfer", v ? "true" : "false")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Payments Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pagos (MercadoPago)
            </CardTitle>
            <CardDescription>Configuración de pagos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payments.currency">Moneda</Label>
              <Input 
                id="payments.currency" 
                value={getValue("payments.currency")}
                onChange={e => updateLocal("payments.currency", e.target.value)}
                placeholder="MXN"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Modo de prueba</Label>
                <p className="text-sm text-slate-400">Usar credenciales de test</p>
              </div>
              <Switch 
                checked={getBool("payments.testMode")}
                onCheckedChange={v => updateLocal("payments.testMode", v ? "true" : "false")}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="payments.serviceFee">Cargo por servicio (%)</Label>
              <Input 
                id="payments.serviceFee" 
                type="number"
                value={getValue("payments.serviceFee")}
                onChange={e => updateLocal("payments.serviceFee", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Configuración de Email
            </CardTitle>
            <CardDescription>Notificaciones y correos automáticos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email.fromName">Nombre remitente</Label>
              <Input 
                id="email.fromName" 
                value={getValue("email.fromName")}
                onChange={e => updateLocal("email.fromName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email.fromEmail">Email remitente</Label>
              <Input 
                id="email.fromEmail" 
                type="email"
                value={getValue("email.fromEmail")}
                onChange={e => updateLocal("email.fromEmail", e.target.value)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enviar confirmación de compra</Label>
                <p className="text-sm text-slate-400">Email automático al completar pago</p>
              </div>
              <Switch 
                checked={getBool("email.sendConfirmation")}
                onCheckedChange={v => updateLocal("email.sendConfirmation", v ? "true" : "false")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enviar recordatorios</Label>
                <p className="text-sm text-slate-400">Recordar eventos próximos</p>
              </div>
              <Switch 
                checked={getBool("email.sendReminder")}
                onCheckedChange={v => updateLocal("email.sendReminder", v ? "true" : "false")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email.reminderHours">Horas antes para recordatorio</Label>
              <Input 
                id="email.reminderHours" 
                type="number"
                value={getValue("email.reminderHours")}
                onChange={e => updateLocal("email.reminderHours", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Seguridad
            </CardTitle>
            <CardDescription>Configuración de acceso y registro</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Requerir verificación de email</Label>
                <p className="text-sm text-slate-400">Los usuarios deben verificar su email</p>
              </div>
              <Switch 
                checked={getBool("security.requireEmailVerification")}
                onCheckedChange={v => updateLocal("security.requireEmailVerification", v ? "true" : "false")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Permitir registro público</Label>
                <p className="text-sm text-slate-400">Cualquiera puede crear una cuenta</p>
              </div>
              <Switch 
                checked={getBool("security.allowRegistration")}
                onCheckedChange={v => updateLocal("security.allowRegistration", v ? "true" : "false")}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="security.sessionTimeout">Duración de sesión (segundos)</Label>
              <Input 
                id="security.sessionTimeout" 
                type="number"
                value={getValue("security.sessionTimeout")}
                onChange={e => updateLocal("security.sessionTimeout", e.target.value)}
              />
              <p className="text-xs text-slate-400">86400 = 24 horas</p>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Apariencia
            </CardTitle>
            <CardDescription>Personalización de la interfaz</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Color Principal</Label>
              <div className="flex gap-2">
                {["#00d4ff", "#8b5cf6", "#10b981", "#f43f5e", "#f59e0b"].map(color => (
                  <button
                    key={color}
                    onClick={() => updateLocal("app.primaryColor", color)}
                    className={`h-10 w-10 rounded-2xl border-2 transition-all ${
                      getValue("app.primaryColor") === color 
                        ? "border-white scale-110" 
                        : "border-white/15"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <Input 
                value={getValue("app.primaryColor")}
                onChange={e => updateLocal("app.primaryColor", e.target.value)}
                placeholder="#00d4ff"
                className="mt-2"
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="app.favicon">URL del Favicon</Label>
              <Input 
                id="app.favicon" 
                value={getValue("app.favicon")}
                onChange={e => updateLocal("app.favicon", e.target.value)}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floating Save Button */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6">
          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending}
            size="lg"
            className="bg-emerald-500 shadow-lg hover:bg-emerald-600"
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-5 w-5" />
            )}
            Guardar cambios
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
