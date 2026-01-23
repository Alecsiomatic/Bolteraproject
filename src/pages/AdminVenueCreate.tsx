import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GlassCard } from "liquid-glass-ui";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useVenues } from "@/hooks/useVenues";
import { BadgeCheck, ChevronLeft, ChevronRight, Map, MapPin, Palette } from "lucide-react";

const steps = ["Detalles", "Ubicación", "Zonas", "Resumen"] as const;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

type ZoneDraft = {
  clientId: string;
  name: string;
  color: string;
  basePrice: string;
};

const buildZone = (): ZoneDraft => ({
  clientId: uid(),
  name: "",
  color: "#38bdf8",
  basePrice: "0",
});

const AdminVenueCreate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: venues } = useVenues();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [details, setDetails] = useState({
    name: "",
    slug: "",
    description: "",
    capacity: "",
  });

  const [location, setLocation] = useState({
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
  });

  const [zones, setZones] = useState<ZoneDraft[]>([buildZone()]);

  const duplicateName = useMemo(() => {
    if (!details.name) return false;
    return Boolean(venues?.some((venue) => venue.name.toLowerCase() === details.name.toLowerCase()));
  }, [details.name, venues]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 0:
        return details.name.trim().length > 3 && !duplicateName;
      case 1:
        return Boolean(location.city && location.country);
      case 2:
        return zones.every((zone) => zone.name.trim().length > 0);
      default:
        return true;
    }
  }, [details, location, zones, step, duplicateName]);

  const handleZoneUpdate = (clientId: string, patch: Partial<ZoneDraft>) => {
    setZones((current) => current.map((zone) => (zone.clientId === clientId ? { ...zone, ...patch } : zone)));
  };

  const removeZone = (clientId: string) => {
    if (zones.length === 1) return;
    setZones((current) => current.filter((zone) => zone.clientId !== clientId));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      const payload = {
        name: details.name.trim(),
        slug: details.slug.trim() || undefined,
        description: details.description.trim() || undefined,
        capacity: details.capacity ? Number(details.capacity) : undefined,
        address: location.address || undefined,
        city: location.city || undefined,
        state: location.state || undefined,
        country: location.country || undefined,
        postalCode: location.postalCode || undefined,
        layout: {
          name: `${details.name.trim()} layout`,
          version: 1,
          json: {},
          isDefault: true,
        },
        zones: zones.map((zone) => ({
          clientId: zone.clientId,
          name: zone.name.trim(),
          color: zone.color || undefined,
          basePrice: zone.basePrice ? Number(zone.basePrice) : undefined,
        })),
        seats: [],
      } as const;

      const response = await api.createVenue(payload);
      toast({ title: "Venue creado", description: "Ahora puedes diseñar el mapa" });
      navigate(`/canvas?venueId=${response.id}&layoutId=${response.layoutId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el venue";
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <Label>Nombre oficial</Label>
              <Input
                className="mt-2"
                placeholder="Arena Glass MX"
                value={details.name}
                onChange={(event) => setDetails((data) => ({ ...data, name: event.target.value }))}
              />
              {duplicateName && <p className="mt-1 text-xs text-amber-400">Ya existe un venue con este nombre.</p>}
            </div>
            <div>
              <Label>Slug (opcional)</Label>
              <Input
                className="mt-2"
                placeholder="arena-glass"
                value={details.slug}
                onChange={(event) => setDetails((data) => ({ ...data, slug: event.target.value }))}
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                className="mt-2 border-white/20 bg-white/5 text-white"
                rows={4}
                placeholder="Datos generales, tipo de recinto, restricciones"
                value={details.description}
                onChange={(event) => setDetails((data) => ({ ...data, description: event.target.value }))}
              />
            </div>
            <div>
              <Label>Capacidad estimada</Label>
              <Input
                className="mt-2"
                type="number"
                min={1}
                placeholder="5000"
                value={details.capacity}
                onChange={(event) => setDetails((data) => ({ ...data, capacity: event.target.value }))}
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Dirección</Label>
              <Input
                className="mt-2"
                placeholder="Av. Principal 123"
                value={location.address}
                onChange={(event) => setLocation((data) => ({ ...data, address: event.target.value }))}
              />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input
                className="mt-2"
                value={location.city}
                onChange={(event) => setLocation((data) => ({ ...data, city: event.target.value }))}
              />
            </div>
            <div>
              <Label>Estado / Provincia</Label>
              <Input
                className="mt-2"
                value={location.state}
                onChange={(event) => setLocation((data) => ({ ...data, state: event.target.value }))}
              />
            </div>
            <div>
              <Label>País</Label>
              <Input
                className="mt-2"
                value={location.country}
                onChange={(event) => setLocation((data) => ({ ...data, country: event.target.value }))}
              />
            </div>
            <div>
              <Label>Código Postal</Label>
              <Input
                className="mt-2"
                value={location.postalCode}
                onChange={(event) => setLocation((data) => ({ ...data, postalCode: event.target.value }))}
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            {zones.map((zone, index) => (
              <GlassCard key={zone.clientId} variant="soft" className="space-y-4 border-white/10 bg-white/5 px-6 py-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Zona {index + 1}</p>
                    <p className="text-lg font-semibold">{zone.name || "Sin nombre"}</p>
                  </div>
                  {zones.length > 1 && (
                    <Button variant="ghost" className="text-rose-300" size="sm" onClick={() => removeZone(zone.clientId)}>
                      Eliminar
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Nombre</Label>
                    <Input
                      className="mt-2"
                      value={zone.name}
                      onChange={(event) => handleZoneUpdate(zone.clientId, { name: event.target.value })}
                      placeholder="VIP"
                    />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <div className="mt-2 flex items-center gap-3">
                      <Input
                        type="color"
                        className="h-10 w-16 cursor-pointer rounded-2xl border border-white/20 bg-transparent p-1"
                        value={zone.color}
                        onChange={(event) => handleZoneUpdate(zone.clientId, { color: event.target.value })}
                      />
                      <Input
                        value={zone.color}
                        onChange={(event) => handleZoneUpdate(zone.clientId, { color: event.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Precio base (opcional)</Label>
                    <Input
                      className="mt-2"
                      type="number"
                      min={0}
                      value={zone.basePrice}
                      onChange={(event) => handleZoneUpdate(zone.clientId, { basePrice: event.target.value })}
                    />
                  </div>
                </div>
              </GlassCard>
            ))}
            <Button
              variant="outline"
              className="border-dashed border-white/30 text-slate-200"
              onClick={() => setZones((current) => [...current, buildZone()])}
            >
              Añadir zona
            </Button>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <GlassCard variant="soft" className="space-y-2 border-white/10 bg-white/5 px-6 py-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Resumen</p>
              <p className="text-2xl font-semibold text-white">{details.name}</p>
              <p className="text-slate-300">{details.description || "Sin descripción"}</p>
              <div className="grid gap-4 py-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">Capacidad</p>
                  <p className="text-white">{details.capacity || "Sin definir"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ciudad</p>
                  <p className="text-white">{location.city || "No indicada"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Zonas</p>
                  <p className="text-white">{zones.length}</p>
                </div>
              </div>
            </GlassCard>
            <div className="grid gap-3 md:grid-cols-2">
              {zones.map((zone) => (
                <div key={zone.clientId} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{zone.name || "Zona"}</p>
                  <p className="text-xs text-slate-400">Color: {zone.color}</p>
                  {zone.basePrice && <p className="text-xs text-slate-400">Desde ${Number(zone.basePrice).toLocaleString("es-MX")}</p>}
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-8 px-2 py-4 text-white lg:px-0">
      <div className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-6 backdrop-blur-2xl">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Nuevo venue</p>
        <h1 className="text-3xl font-semibold">Registra un venue productivo</h1>
        <p className="text-slate-300">Captura datos clave y luego diseña el mapa en el canvas.</p>
      </div>

      <GlassCard variant="intense" className="space-y-6 border-white/10 bg-white/10 px-8 py-8">
        <div className="flex flex-wrap gap-4">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl border",
                  index === step && "border-cyan-400 bg-white/10 text-white",
                  index < step && "border-emerald-400 bg-emerald-400/20 text-emerald-200",
                  index > step && "border-white/20 text-slate-400",
                )}
              >
                {index < step ? <BadgeCheck className="h-5 w-5" /> : index + 1}
              </div>
              <span className={cn("text-sm", index === step ? "text-white" : "text-slate-400")}>{label}</span>
              {index < steps.length - 1 && <div className="h-px w-10 bg-white/10" />}
            </div>
          ))}
        </div>

        <div>{renderStep()}</div>

        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" className="text-slate-300" disabled={step === 0 || submitting} onClick={() => setStep((value) => Math.max(0, value - 1))}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>
          <div className="flex gap-3">
            {step === steps.length - 1 ? (
              <Button onClick={handleSubmit} disabled={!canProceed || submitting} className="px-6">
                {submitting ? "Guardando" : "Crear venue y abrir canvas"}
                <Map className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))} disabled={!canProceed} className="px-6">
                Continuar
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      <div className="rounded-[24px] border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-300">
        <p className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-cyan-300" />
          Después de este wizard, el canvas se abrirá con el venue listo para diseñar el mapa. Guarda tus cambios desde el canvas para consolidar el layout.
        </p>
        <p className="mt-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-300" />
          Puedes volver a este wizard para actualizar los metadatos del venue cuando lo necesites.
        </p>
      </div>
    </div>
  );
};

export default AdminVenueCreate;
