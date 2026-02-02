import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GlassCard } from "liquid-glass-ui";
import { useVenues } from "@/hooks/useVenues";
import { useVenue } from "@/hooks/useVenue";
import { useVenueLayout } from "@/hooks/useVenueLayout";
import { useVenueLayouts } from "@/hooks/useVenueLayouts";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { API_BASE_URL } from "@/lib/api-base";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Coins, 
  Image as ImageIcon,
  Layers, 
  MapPin, 
  Tag,
  DollarSign,
  Upload,
  Trash2,
  Plus,
  Star,
  Info,
  AlertCircle,
  Music,
  ListMusic,
  UserCircle,
} from "lucide-react";

// Steps del wizard - organizados por importancia para el flujo
const steps = [
  { id: "basics", label: "Información", icon: Info },
  { id: "venue", label: "Venue & Layout", icon: MapPin },
  { id: "sessions", label: "Funciones", icon: Calendar },
  { id: "pricing", label: "Precios", icon: DollarSign },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "review", label: "Revisar", icon: CheckCircle2 },
] as const;

const eventStatuses = ["DRAFT", "PUBLISHED"] as const;
const sessionStatuses = ["SCHEDULED", "SALES_OPEN"] as const;
const seatTypes = ["STANDARD", "VIP", "ACCESSIBLE", "COMPANION"] as const;
const ageRestrictions = ["Todas las edades", "13+", "16+", "18+", "21+"] as const;
const eventTypes = ["seated", "general"] as const;
const serviceFeeTypes = ["percentage", "fixed"] as const;
const stagePositions = ["top", "bottom", "left", "right"] as const;

type SessionDraft = {
  clientId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  doorsOpenAt: string;
  capacity?: string;
  status: (typeof sessionStatuses)[number];
};

type TierDraft = {
  clientId: string;
  label: string;
  description: string;
  price: string;
  fee: string;
  currency: string;
  zoneId?: string;
  sectionId?: string;
  seatType?: (typeof seatTypes)[number];
  scope: "all" | string;
  maxQuantity: string;
  isDefault: boolean;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
};

const uid = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const buildSession = (): SessionDraft => ({
  clientId: uid(),
  title: "",
  startsAt: "",
  endsAt: "",
  doorsOpenAt: "",
  capacity: "",
  status: "SCHEDULED",
});

const buildTier = (): TierDraft => ({
  clientId: uid(),
  label: "",
  description: "",
  price: "0",
  fee: "0",
  currency: "MXN",
  scope: "all",
  maxQuantity: "10",
  isDefault: true,
});

const AdminEventCreate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: venues, isLoading: venuesLoading } = useVenues();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // ========== PASO 1: Información Básica ==========
  const [basics, setBasics] = useState({
    name: "",
    shortDescription: "",
    description: "",
    categoryId: "",
    artistName: "",
    organizer: "",
    ageRestriction: "Todas las edades",
    duration: "",
    status: "PUBLISHED" as (typeof eventStatuses)[number],
    isFeatured: false,
  });

  // ========== Tipo de Evento y Cargo de Servicio ==========
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>("seated");
  const [serviceFee, setServiceFee] = useState({
    type: "" as (typeof serviceFeeTypes)[number] | "",
    value: "",
  });
  const [showRemainingTickets, setShowRemainingTickets] = useState(false);
  const [stagePosition, setStagePosition] = useState<(typeof stagePositions)[number]>("top");

  // ========== PASO 2: Venue & Layout ==========
  const [venueId, setVenueId] = useState<string>("");
  const [layoutId, setLayoutId] = useState<string>("");

  // ========== PASO 3: Sesiones ==========
  const [sessions, setSessions] = useState<SessionDraft[]>([buildSession()]);

  // ========== PASO 4: Precios ==========
  const [tiers, setTiers] = useState<TierDraft[]>([buildTier()]);
  const [salesConfig, setSalesConfig] = useState({
    salesStartAt: "",
    salesEndAt: "",
  });

  // ========== PASO 5: Media ==========
  const [media, setMedia] = useState({
    coverImage: "",
    thumbnailImage: "",
    videoUrl: "",
  });

  // ========== Artista y Playlist ==========
  const [artistId, setArtistId] = useState<string>("");
  const [playlistId, setPlaylistId] = useState<string>("");
  const [artists, setArtists] = useState<Array<{ id: string; name: string; profileImage?: string }>>([]);
  const [playlists, setPlaylists] = useState<Array<{ id: string; name: string; coverUrl?: string; _count?: { tracks: number } }>>([]);
  const [showCreateArtist, setShowCreateArtist] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newArtist, setNewArtist] = useState({ name: "", bio: "" });
  const [newPlaylist, setNewPlaylist] = useState({ name: "", description: "" });
  const [creatingArtist, setCreatingArtist] = useState(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  // ========== Cargar categorías ==========
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    api.listCategories(true).then(setCategories).catch(console.error);
  }, []);

  // ========== Cargar artistas y playlists ==========
  
  useEffect(() => {
    // Cargar artistas
    fetch(`${API_BASE_URL}/api/artists?active=true`)
      .then(res => res.json())
      .then(data => setArtists(data.artists || data || []))
      .catch(console.error);
    
    // Cargar playlists
    fetch(`${API_BASE_URL}/api/playlists?active=true`)
      .then(res => res.json())
      .then(data => setPlaylists(data.playlists || data || []))
      .catch(console.error);
  }, []);

  const handleCreateArtist = async () => {
    if (!newArtist.name.trim()) return;
    setCreatingArtist(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newArtist.name, bio: newArtist.bio, isActive: true }),
      });
      if (!res.ok) throw new Error('Error al crear artista');
      const created = await res.json();
      setArtists(prev => [...prev, created]);
      setArtistId(created.id);
      setShowCreateArtist(false);
      setNewArtist({ name: "", bio: "" });
      toast({ title: "Artista creado", description: `"${created.name}" agregado` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el artista" });
    } finally {
      setCreatingArtist(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylist.name.trim()) return;
    setCreatingPlaylist(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaylist.name, description: newPlaylist.description, isActive: true, isPublic: true }),
      });
      if (!res.ok) throw new Error('Error al crear playlist');
      const created = await res.json();
      setPlaylists(prev => [...prev, created]);
      setPlaylistId(created.id);
      setShowCreatePlaylist(false);
      setNewPlaylist({ name: "", description: "" });
      toast({ title: "Playlist creada", description: `"${created.name}" agregada` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear la playlist" });
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // ========== Venue & Layout Data ==========
  const { data: venueDetail, isFetching: venueLoading } = useVenue(venueId);
  const { data: venueLayouts, isLoading: layoutsLoading } = useVenueLayouts(venueId);

  const selectedLayout = useMemo(() => {
    if (!venueLayouts?.length) return null;
    if (layoutId) return venueLayouts.find(l => l.id === layoutId) ?? null;
    const defaultLayout = venueLayouts.find(l => l.isDefault);
    return defaultLayout ?? venueLayouts[0] ?? null;
  }, [venueLayouts, layoutId]);

  useMemo(() => {
    if (selectedLayout && !layoutId) {
      setLayoutId(selectedLayout.id);
    }
  }, [selectedLayout, layoutId]);

  const { data: layoutDetail } = useVenueLayout(venueId, selectedLayout?.id);

  const venueZones = layoutDetail?.zones ?? venueDetail?.zones ?? [];
  // El backend devuelve sections pero el tipo no lo incluye aún
  const venueSections = (layoutDetail as any)?.sections ?? [];
  const totalSeats = layoutDetail?.seats?.length ?? selectedLayout?.seatCount ?? venueDetail?.stats?.totalSeats ?? 0;

  // Auto-generate tiers from SECTIONS (priority) or zones when layout changes
  // SOLO para eventos con asientos (seated), NO para general admission
  useEffect(() => {
    // No auto-generar tiers desde secciones si es admisión general
    if (eventType === "general") {
      return;
    }
    
    if (tiers.length === 1 && !tiers[0].label.trim()) {
      // Priorizar secciones sobre zonas
      if (venueSections.length > 0) {
        const sectionTiers: TierDraft[] = venueSections.map((section: any) => ({
          clientId: `tier-section-${section.id}`,
          label: section.name || "Sección",
          description: `${section.seatCount || 0} asientos`,
          price: "0",
          fee: "0",
          currency: "MXN",
          scope: "all",
          maxQuantity: "10",
          isDefault: false,
          zoneId: undefined,
          sectionId: section.id,
        }));
        setTiers(sectionTiers);
      } else if (venueZones.length > 0) {
        // Fallback a zonas
        const zoneTiers: TierDraft[] = venueZones.map((zone: any) => ({
          clientId: `tier-${zone.id}`,
          label: zone.name || "General",
          description: "",
          price: zone.basePrice ? String(zone.basePrice) : "0",
          fee: "0",
          currency: "MXN",
          scope: "all",
          maxQuantity: "10",
          isDefault: false,
          zoneId: zone.id,
        }));
        setTiers(zoneTiers);
      }
    }
  }, [venueSections, venueZones, eventType]);

  // Limpiar tiers cuando cambia el tipo de evento para evitar mezclar datos
  useEffect(() => {
    // Resetear tiers a uno vacío cuando cambia el tipo de evento
    if (tiers.length > 0 && tiers[0].sectionId) {
      // Si hay tiers con sectionId y cambió a general, resetear
      if (eventType === "general") {
        setTiers([buildTier()]);
      }
    }
  }, [eventType]);

  // ========== Session Options for Tiers ==========
  const sessionOptions = useMemo(
    () => sessions.map((session, index) => ({ 
      value: session.clientId, 
      label: session.title || `Función ${index + 1}` 
    })),
    [sessions],
  );

  // ========== Validaciones por paso ==========
  const canProceed = useMemo(() => {
    switch (step) {
      case 0: // Información básica - artistId es obligatorio
        return basics.name.trim().length >= 3 && basics.categoryId !== "" && artistId !== "";
      case 1: // Venue & Layout
        return Boolean(venueId);
      case 2: // Sesiones
        return sessions.every((s) => Boolean(s.startsAt));
      case 3: // Precios - al menos un tier con label y precio >= 0
        const validTiers = tiers.filter((t) => t.label.trim().length > 0 && Number(t.price) >= 0);
        return validTiers.length > 0;
      case 4: // Media (opcional)
        return true;
      default:
        return true;
    }
  }, [basics, venueId, sessions, tiers, step, artistId]);

  const canSubmit = canProceed && sessions.length > 0 && tiers.length > 0 && artistId !== "";

  // ========== Handlers ==========
  const updateSession = (clientId: string, patch: Partial<SessionDraft>) => {
    setSessions((current) => current.map((s) => (s.clientId === clientId ? { ...s, ...patch } : s)));
  };

  const updateTier = (clientId: string, patch: Partial<TierDraft>) => {
    setTiers((current) => current.map((t) => (t.clientId === clientId ? { ...t, ...patch } : t)));
  };

  const removeSession = (clientId: string) => {
    if (sessions.length === 1) return;
    setSessions((current) => current.filter((s) => s.clientId !== clientId));
    setTiers((current) => current.map((t) => (t.scope === clientId ? { ...t, scope: "all" } : t)));
  };

  const removeTier = (clientId: string) => {
    if (tiers.length === 1) return;
    setTiers((current) => current.filter((t) => t.clientId !== clientId));
  };

  // ========== Upload de imagen ==========
  const handleImageUpload = async (file: File, field: "coverImage" | "thumbnailImage") => {
    try {
      const result = await api.uploadImage("events", file);
      console.log("Image uploaded:", result);
      setMedia((prev) => ({ ...prev, [field]: result.url }));
      toast({ title: "Imagen subida", description: "La imagen se cargó correctamente" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo subir la imagen" });
    }
  };

  // ========== Submit ==========
  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    try {
      setSubmitting(true);
      const payload = {
        // Basics
        name: basics.name.trim(),
        shortDescription: basics.shortDescription?.trim() || undefined,
        description: basics.description?.trim() || undefined,
        categoryId: basics.categoryId || undefined,
        artistName: basics.artistName?.trim() || undefined,
        organizer: basics.organizer?.trim() || undefined,
        ageRestriction: basics.ageRestriction !== "Todas las edades" ? basics.ageRestriction : undefined,
        duration: basics.duration?.trim() || undefined,
        status: basics.status,
        isFeatured: basics.isFeatured,
        
        // Artist & Playlist
        artistId: artistId || undefined,
        playlistId: playlistId || undefined,
        
        // Event type and service fee
        eventType,
        serviceFeeType: serviceFee.type || undefined,
        serviceFeeValue: serviceFee.value ? Number(serviceFee.value) : undefined,
        showRemainingTickets: eventType === "general" ? showRemainingTickets : undefined,
        stagePosition: eventType === "seated" ? stagePosition : undefined,
        
        // Venue
        venueId,
        layoutId: eventType === "seated" ? (layoutId || selectedLayout?.id) : undefined,
        createdById: user?.id,
        
        // Sales config
        salesStartAt: salesConfig.salesStartAt ? new Date(salesConfig.salesStartAt).toISOString() : undefined,
        salesEndAt: salesConfig.salesEndAt ? new Date(salesConfig.salesEndAt).toISOString() : undefined,
        
        // Media
        coverImage: media.coverImage || undefined,
        thumbnailImage: media.thumbnailImage || undefined,
        videoUrl: media.videoUrl?.trim() || undefined,
        
        // Sessions
        sessions: sessions.map((s) => ({
          clientId: s.clientId,
          title: s.title || undefined,
          startsAt: new Date(s.startsAt).toISOString(),
          endsAt: s.endsAt ? new Date(s.endsAt).toISOString() : undefined,
          doorsOpenAt: s.doorsOpenAt ? new Date(s.doorsOpenAt).toISOString() : undefined,
          status: s.status,
          capacity: s.capacity ? Number(s.capacity) : undefined,
        })),
        
        // Tiers
        tiers: tiers.map((t) => ({
          clientId: t.clientId,
          label: t.label.trim(),
          description: t.description?.trim() || undefined,
          price: Number(t.price),
          fee: t.fee ? Number(t.fee) : 0,
          currency: t.currency,
          zoneId: t.zoneId || undefined,
          sectionId: t.sectionId || undefined,
          seatType: t.seatType || undefined,
          sessionKeys: t.scope === "all" ? undefined : [t.scope],
          maxQuantity: undefined, // No usado actualmente
          capacity: eventType === "general" ? (t.maxQuantity ? Number(t.maxQuantity) : undefined) : undefined,
          isDefault: t.isDefault,
        })),
      };

      const result = await api.createEvent(payload);
      toast({ title: "¡Evento creado!", description: `"${basics.name}" está listo` });
      navigate(`/admin/events/${result.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el evento";
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  // ========== Render de cada paso ==========
  const renderStep = () => {
    switch (step) {
      // ========== PASO 0: Información Básica ==========
      case 0:
        return (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Nombre del evento */}
              <div className="md:col-span-2">
                <Label className="text-white">Nombre del evento *</Label>
                <Input
                  value={basics.name}
                  onChange={(e) => setBasics((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Coldplay Music of the Spheres World Tour"
                  className="mt-2 border-white/20 bg-white/5 text-white"
                />
              </div>

              {/* Categoría */}
              <div>
                <Label className="text-white">Categoría *</Label>
                <Select 
                  value={basics.categoryId} 
                  onValueChange={(v) => setBasics((p) => ({ ...p, categoryId: v }))}
                >
                  <SelectTrigger className="mt-2 border-white/20 bg-white/5 text-white">
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5" style={{ color: cat.color }} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Artista/Presentador - OBLIGATORIO */}
              <div>
                <Label className="text-white">Artista / Presentador *</Label>
                <div className="mt-2 flex gap-2">
                  <Select 
                    value={artistId} 
                    onValueChange={setArtistId}
                  >
                    <SelectTrigger className="flex-1 border-white/20 bg-white/5 text-white">
                      <SelectValue placeholder="Selecciona artista">
                        {artistId && artists.find(a => a.id === artistId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 text-white">
                      {artists.map((artist) => (
                        <SelectItem key={artist.id} value={artist.id}>
                          <div className="flex items-center gap-2">
                            <UserCircle className="h-3.5 w-3.5 text-[#ffc800]" />
                            {artist.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-[#ffc800]/50 bg-[#ffc800]/10 text-[#ffc800] hover:bg-[#ffc800]/20"
                    onClick={() => setShowCreateArtist(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Playlist - OPCIONAL */}
              <div>
                <Label className="text-white">Playlist de música</Label>
                <div className="mt-2 flex gap-2">
                  <Select 
                    value={playlistId || "__none__"} 
                    onValueChange={(v) => setPlaylistId(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="flex-1 border-white/20 bg-white/5 text-white">
                      <SelectValue placeholder="Sin playlist (opcional)">
                        {playlistId && playlists.find(p => p.id === playlistId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 text-white">
                      <SelectItem value="__none__">
                        <div className="flex items-center gap-2 text-white/50">
                          <Music className="h-3.5 w-3.5" />
                          Sin playlist
                        </div>
                      </SelectItem>
                      {playlists.map((playlist) => (
                        <SelectItem key={playlist.id} value={playlist.id}>
                          <div className="flex items-center gap-2">
                            <ListMusic className="h-3.5 w-3.5 text-[#ffc800]" />
                            {playlist.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-[#ffc800]/50 bg-[#ffc800]/10 text-[#ffc800] hover:bg-[#ffc800]/20"
                    onClick={() => setShowCreatePlaylist(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Organizador */}
              <div>
                <Label className="text-white">Organizador / Productora</Label>
                <Input
                  value={basics.organizer}
                  onChange={(e) => setBasics((p) => ({ ...p, organizer: e.target.value }))}
                  placeholder="Ej: OCESA, Live Nation"
                  className="mt-2 border-white/20 bg-white/5 text-white"
                />
              </div>

              {/* Restricción de edad */}
              <div>
                <Label className="text-white">Restricción de edad</Label>
                <Select 
                  value={basics.ageRestriction} 
                  onValueChange={(v) => setBasics((p) => ({ ...p, ageRestriction: v }))}
                >
                  <SelectTrigger className="mt-2 border-white/20 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white">
                    {ageRestrictions.map((age) => (
                      <SelectItem key={age} value={age}>{age}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duración */}
              <div>
                <Label className="text-white">Duración aproximada</Label>
                <Input
                  value={basics.duration}
                  onChange={(e) => setBasics((p) => ({ ...p, duration: e.target.value }))}
                  placeholder="Ej: 2 horas 30 minutos"
                  className="mt-2 border-white/20 bg-white/5 text-white"
                />
              </div>

              {/* Estado del evento */}
              <div>
                <Label className="text-white">Estado del evento</Label>
                <Select 
                  value={basics.status} 
                  onValueChange={(v) => setBasics((p) => ({ ...p, status: v as (typeof eventStatuses)[number] }))}
                >
                  <SelectTrigger className="mt-2 border-white/20 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white">
                    <SelectItem value="PUBLISHED">Publicado (visible para todos)</SelectItem>
                    <SelectItem value="DRAFT">Borrador (solo visible para admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Descripción corta */}
              <div className="md:col-span-2">
                <Label className="text-white">Descripción corta (para tarjetas)</Label>
                <Input
                  value={basics.shortDescription}
                  onChange={(e) => setBasics((p) => ({ ...p, shortDescription: e.target.value }))}
                  placeholder="Máx 200 caracteres - aparece en listados"
                  maxLength={200}
                  className="mt-2 border-white/20 bg-white/5 text-white"
                />
                <p className="mt-1 text-xs text-slate-500">{basics.shortDescription.length}/200</p>
              </div>

              {/* Descripción completa */}
              <div className="md:col-span-2">
                <Label className="text-white">Descripción completa</Label>
                <Textarea
                  value={basics.description}
                  onChange={(e) => setBasics((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe el evento, line-up, información importante..."
                  className="mt-2 min-h-[120px] border-white/20 bg-white/5 text-white"
                />
              </div>
            </div>

            {/* Opciones de publicación */}
            <GlassCard variant="soft" className="border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-amber-400" />
                  <div>
                    <p className="font-medium text-white">Evento destacado</p>
                    <p className="text-sm text-slate-400">Aparecerá en la sección principal</p>
                  </div>
                </div>
                <Switch
                  checked={basics.isFeatured}
                  onCheckedChange={(v) => setBasics((p) => ({ ...p, isFeatured: v }))}
                />
              </div>
            </GlassCard>
          </div>
        );

      // ========== PASO 1: Venue & Layout ==========
      case 1:
        return (
          <div className="space-y-6">
            {/* Tipo de Evento */}
            <div>
              <Label className="text-white">Tipo de evento *</Label>
              <p className="mb-3 text-xs text-slate-400">
                Selecciona cómo se venderán los boletos para este evento
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setEventType("seated")}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                    eventType === "seated"
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-white/20 bg-white/5 hover:border-white/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Layers className={cn("h-5 w-5", eventType === "seated" ? "text-cyan-400" : "text-slate-400")} />
                    <span className={cn("font-medium", eventType === "seated" ? "text-white" : "text-slate-300")}>
                      Con mapa de asientos
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Los usuarios seleccionan su asiento en el mapa. Ideal para teatros, estadios, conciertos numerados.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setEventType("general")}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                    eventType === "general"
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-white/20 bg-white/5 hover:border-white/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Tag className={cn("h-5 w-5", eventType === "general" ? "text-cyan-400" : "text-slate-400")} />
                    <span className={cn("font-medium", eventType === "general" ? "text-white" : "text-slate-300")}>
                      Admisión general
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Sin selección de asiento. El usuario compra boletos por cantidad. Ideal para conciertos de pie, festivales.
                  </p>
                </button>
              </div>
            </div>

            {/* Cargo de servicio global */}
            <GlassCard variant="soft" className="border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3 mb-3">
                <Coins className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="font-medium text-white">Cargo de servicio global</p>
                  <p className="text-xs text-slate-400">Se aplicará a todos los boletos de este evento</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-white text-sm">Tipo de cargo</Label>
                  <Select
                    value={serviceFee.type}
                    onValueChange={(v) => setServiceFee((p) => ({ ...p, type: v as (typeof serviceFeeTypes)[number] }))}
                  >
                    <SelectTrigger className="mt-1 border-white/20 bg-white/5 text-white">
                      <SelectValue placeholder="Sin cargo de servicio" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 text-white">
                      <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                      <SelectItem value="fixed">Monto fijo ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {serviceFee.type && (
                  <div>
                    <Label className="text-white text-sm">
                      {serviceFee.type === "percentage" ? "Porcentaje" : "Monto"} *
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        type="number"
                        min="0"
                        step={serviceFee.type === "percentage" ? "0.1" : "1"}
                        value={serviceFee.value}
                        onChange={(e) => setServiceFee((p) => ({ ...p, value: e.target.value }))}
                        placeholder={serviceFee.type === "percentage" ? "Ej: 10" : "Ej: 50"}
                        className="border-white/20 bg-white/5 text-white pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {serviceFee.type === "percentage" ? "%" : "MXN"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Selector de Venue */}
            <div>
              <Label className="text-white">Selecciona el venue *</Label>
              <Select
                disabled={venuesLoading || !venues?.length}
                value={venueId}
                onValueChange={(value) => {
                  setVenueId(value);
                  setLayoutId("");
                }}
              >
                <SelectTrigger className="mt-2 border-white/20 bg-white/5 text-white">
                  <SelectValue placeholder={venuesLoading ? "Cargando venues..." : "Escoge un venue"} />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-white">
                  {venues?.map((venue) => (
                    <SelectItem value={venue.id} key={venue.id}>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                        {venue.name}
                        <span className="text-xs text-slate-500">
                          ({venue.capacity || venue.stats?.totalSeats || 0} cap.)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selector de Layout - Solo para eventos con asientos */}
            {venueId && eventType === "seated" && (
              <div>
                <Label className="text-white">Layout del evento</Label>
                <p className="mb-2 text-xs text-slate-400">
                  El layout define la disposición de asientos. Se creará una copia para este evento.
                </p>
                <Select
                  disabled={layoutsLoading || !venueLayouts?.length}
                  value={layoutId || selectedLayout?.id || ""}
                  onValueChange={(value) => setLayoutId(value)}
                >
                  <SelectTrigger className="border-white/20 bg-white/5 text-white">
                    <SelectValue placeholder={layoutsLoading ? "Cargando layouts..." : "Selecciona layout"} />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white">
                    {venueLayouts?.map((layout) => (
                      <SelectItem value={layout.id} key={layout.id}>
                        <div className="flex items-center gap-2">
                          <Layers className="h-3.5 w-3.5 text-violet-400" />
                          <span>{layout.name}</span>
                          {layout.isDefault && (
                            <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-300">
                              Default
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            ({layout.seatCount} asientos)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Info para admisión general */}
            {venueId && eventType === "general" && (
              <GlassCard variant="soft" className="border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-white">Evento sin mapa de asientos</p>
                    <p className="text-sm text-slate-300 mt-1">
                      Los boletos se venderán por cantidad sin selección de asiento. 
                      Configura los tipos de boleto y su capacidad en el paso de <strong>Precios</strong>.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg border border-amber-400/40 bg-amber-400/10 p-3">
                  <div>
                    <p className="text-sm font-medium text-white">Mostrar boletos restantes</p>
                    <p className="text-xs text-amber-100/80">Comparte cuántos boletos quedan mientras los clientes compran.</p>
                  </div>
                  <Switch
                    checked={showRemainingTickets}
                    onCheckedChange={setShowRemainingTickets}
                    aria-label="Mostrar boletos restantes"
                  />
                </div>
              </GlassCard>
            )}

            {/* Selector de posición del escenario - Solo para eventos con asientos */}
            {venueId && eventType === "seated" && (
              <div>
                <Label className="text-white">Posición del escenario</Label>
                <p className="mb-3 text-xs text-slate-400">
                  Indica dónde se ubicará el escenario respecto al mapa de asientos
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "top", label: "Arriba", icon: "⬆️" },
                    { value: "bottom", label: "Abajo", icon: "⬇️" },
                    { value: "left", label: "Izquierda", icon: "⬅️" },
                    { value: "right", label: "Derecha", icon: "➡️" },
                  ].map((pos) => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => setStagePosition(pos.value as (typeof stagePositions)[number])}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border p-3 transition-all",
                        stagePosition === pos.value
                          ? "border-amber-500 bg-amber-500/20 text-white"
                          : "border-white/20 bg-white/5 text-slate-400 hover:border-white/30"
                      )}
                    >
                      <span className="text-xl">{pos.icon}</span>
                      <span className="text-xs font-medium">{pos.label}</span>
                    </button>
                  ))}
                </div>
                {/* Preview visual */}
                <div className="mt-4 flex items-center justify-center">
                  <div className="relative w-40 h-32 border border-white/20 rounded-lg bg-white/5">
                    {/* Escenario */}
                    <div
                      className={cn(
                        "absolute bg-amber-500/40 border border-amber-500 flex items-center justify-center text-[10px] text-amber-200 font-medium",
                        stagePosition === "top" && "top-0 left-1/2 -translate-x-1/2 w-20 h-5 rounded-b-lg",
                        stagePosition === "bottom" && "bottom-0 left-1/2 -translate-x-1/2 w-20 h-5 rounded-t-lg",
                        stagePosition === "left" && "left-0 top-1/2 -translate-y-1/2 w-5 h-16 rounded-r-lg [writing-mode:vertical-rl]",
                        stagePosition === "right" && "right-0 top-1/2 -translate-y-1/2 w-5 h-16 rounded-l-lg [writing-mode:vertical-rl]"
                      )}
                    >
                      🎭
                    </div>
                    {/* Asientos placeholder */}
                    <div className={cn(
                      "absolute grid grid-cols-5 gap-1",
                      stagePosition === "top" && "top-8 left-1/2 -translate-x-1/2",
                      stagePosition === "bottom" && "bottom-8 left-1/2 -translate-x-1/2",
                      stagePosition === "left" && "left-8 top-1/2 -translate-y-1/2",
                      stagePosition === "right" && "right-8 top-1/2 -translate-y-1/2"
                    )}>
                      {Array.from({ length: 15 }).map((_, i) => (
                        <div key={i} className="w-2 h-2 rounded-sm bg-cyan-500/40" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Resumen del Venue */}
            {venueId && (
              <GlassCard variant="soft" className="border-white/10 bg-white/5 p-5">
                {venueLoading ? (
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
                    Cargando detalles...
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-cyan-500/20 p-2.5">
                        <MapPin className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{venueDetail?.name}</p>
                        <p className="text-sm text-slate-400">{venueDetail?.address || "Sin dirección"}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 rounded-2xl bg-white/5 p-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{totalSeats}</p>
                        <p className="text-xs text-slate-400">Asientos</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{venueZones.length}</p>
                        <p className="text-xs text-slate-400">Zonas</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{selectedLayout?.name?.slice(0, 8) || "—"}</p>
                        <p className="text-xs text-slate-400">Layout</p>
                      </div>
                    </div>

                    {venueZones.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-300">Zonas disponibles:</p>
                        <div className="flex flex-wrap gap-2">
                          {venueZones.map((zone: any) => (
                            <div
                              key={zone.id}
                              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1"
                            >
                              <div 
                                className="h-2.5 w-2.5 rounded-full" 
                                style={{ backgroundColor: zone.color || "#888" }} 
                              />
                              <span className="text-sm text-white">{zone.name}</span>
                              <span className="text-xs text-slate-500">
                                {zone.seatCount || zone.capacity || 0}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            )}
          </div>
        );

      // ========== PASO 2: Sesiones ==========
      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Funciones del evento</h3>
                <p className="text-sm text-slate-400">
                  Cada función es una fecha/hora específica donde se presenta el evento
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-white/20 text-white"
                onClick={() => setSessions((c) => [...c, buildSession()])}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar función
              </Button>
            </div>

            {sessions.map((session, index) => (
              <GlassCard key={session.clientId} variant="soft" className="border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-sm font-bold text-violet-300">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-white">{session.title || `Función ${index + 1}`}</p>
                      {session.startsAt && (
                        <p className="text-xs text-slate-400">
                          {new Date(session.startsAt).toLocaleDateString("es-MX", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  {sessions.length > 1 && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                      onClick={() => removeSession(session.clientId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-slate-300">Título (opcional)</Label>
                    <Input
                      value={session.title}
                      onChange={(e) => updateSession(session.clientId, { title: e.target.value })}
                      placeholder="Ej: Función de gala, Matinée, Noche"
                      className="mt-1.5 border-white/15 bg-white/5 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-slate-300">Capacidad (opcional)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={session.capacity ?? ""}
                      onChange={(e) => updateSession(session.clientId, { capacity: e.target.value })}
                      placeholder={`Máx: ${totalSeats}`}
                      className="mt-1.5 border-white/15 bg-white/5 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-slate-300">Fecha y hora de inicio *</Label>
                    <Input
                      type="datetime-local"
                      value={session.startsAt}
                      onChange={(e) => updateSession(session.clientId, { startsAt: e.target.value })}
                      className="mt-1.5 border-white/15 bg-white/5 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-slate-300">Fecha y hora de fin</Label>
                    <Input
                      type="datetime-local"
                      value={session.endsAt}
                      onChange={(e) => updateSession(session.clientId, { endsAt: e.target.value })}
                      className="mt-1.5 border-white/15 bg-white/5 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-slate-300">Apertura de puertas</Label>
                    <Input
                      type="datetime-local"
                      value={session.doorsOpenAt}
                      onChange={(e) => updateSession(session.clientId, { doorsOpenAt: e.target.value })}
                      className="mt-1.5 border-white/15 bg-white/5 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-slate-300">Estado</Label>
                    <Select 
                      value={session.status} 
                      onValueChange={(v) => updateSession(session.clientId, { status: v as SessionDraft["status"] })}
                    >
                      <SelectTrigger className="mt-1.5 border-white/15 bg-white/5 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 text-white">
                        <SelectItem value="SCHEDULED">Programada</SelectItem>
                        <SelectItem value="SALES_OPEN">Ventas abiertas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        );

      // ========== PASO 3: Precios ==========
      case 3:
        return (
          <div className="space-y-6">
            {/* Configuración de ventas */}
            <GlassCard variant="soft" className="border-white/10 bg-white/5 p-5">
              <h3 className="mb-4 font-semibold text-white">Periodo de venta</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-slate-300">Inicio de venta</Label>
                  <Input
                    type="datetime-local"
                    value={salesConfig.salesStartAt}
                    onChange={(e) => setSalesConfig((p) => ({ ...p, salesStartAt: e.target.value }))}
                    className="mt-1.5 border-white/15 bg-white/5 text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500">Cuándo se pueden empezar a comprar boletos</p>
                </div>
                <div>
                  <Label className="text-slate-300">Fin de venta</Label>
                  <Input
                    type="datetime-local"
                    value={salesConfig.salesEndAt}
                    onChange={(e) => setSalesConfig((p) => ({ ...p, salesEndAt: e.target.value }))}
                    className="mt-1.5 border-white/15 bg-white/5 text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500">Cuándo se cierran las ventas (opcional)</p>
                </div>
              </div>
            </GlassCard>

            {/* ========== UI para Admisión General ========== */}
            {eventType === "general" && (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">Tipos de boleto</h3>
                      <p className="text-sm text-slate-400">
                        Define los tipos de boleto disponibles y su capacidad máxima.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTiers((c) => [...c, buildTier()])}
                      className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Agregar tipo
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {tiers.map((tier, index) => (
                    <GlassCard key={tier.clientId} variant="soft" className="border-white/10 bg-white/5 p-4">
                      <div className="space-y-4">
                        {/* Header con nombre y eliminar */}
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Input
                              value={tier.label}
                              onChange={(e) => updateTier(tier.clientId, { label: e.target.value })}
                              placeholder="Ej: General, VIP, Preferente"
                              className="bg-white/5 border-white/20 text-white font-medium"
                            />
                          </div>
                          {tiers.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeTier(tier.clientId)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* Descripción */}
                        <div>
                          <Label className="text-slate-400 text-xs">Descripción (opcional)</Label>
                          <Input
                            value={tier.description}
                            onChange={(e) => updateTier(tier.clientId, { description: e.target.value })}
                            placeholder="Ej: Acceso a zona general, consumición incluida"
                            className="mt-1 bg-white/5 border-white/20 text-white text-sm"
                          />
                        </div>

                        {/* Precio y Capacidad */}
                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <Label className="text-slate-400 text-xs">Precio *</Label>
                            <div className="relative mt-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                              <Input
                                type="number"
                                value={tier.price}
                                onChange={(e) => updateTier(tier.clientId, { price: e.target.value })}
                                className="pl-7 bg-white/5 border-white/20 text-white"
                                placeholder="0"
                                min={0}
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-slate-400 text-xs">Capacidad *</Label>
                            <Input
                              type="number"
                              value={tier.maxQuantity}
                              onChange={(e) => updateTier(tier.clientId, { maxQuantity: e.target.value })}
                              className="mt-1 bg-white/5 border-white/20 text-white"
                              placeholder="Ej: 500"
                              min={1}
                            />
                            <p className="mt-0.5 text-[10px] text-slate-500">Total disponible</p>
                          </div>
                          <div>
                            <Label className="text-slate-400 text-xs">Cargo/Fee</Label>
                            <div className="relative mt-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                              <Input
                                type="number"
                                value={tier.fee || "0"}
                                onChange={(e) => updateTier(tier.clientId, { fee: e.target.value })}
                                className="pl-7 bg-white/5 border-white/20 text-white"
                                placeholder="0"
                                min={0}
                              />
                            </div>
                            <p className="mt-0.5 text-[10px] text-slate-500">Cargo adicional por boleto</p>
                          </div>
                        </div>

                        {/* Funciones aplicables */}
                        {sessions.length > 1 && (
                          <div>
                            <Label className="text-slate-400 text-xs">Aplica para</Label>
                            <Select
                              value={tier.scope}
                              onValueChange={(v) => updateTier(tier.clientId, { scope: v })}
                            >
                              <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 text-white">
                                <SelectItem value="all">Todas las funciones</SelectItem>
                                {sessionOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  ))}
                </div>

                {/* Resumen */}
                <GlassCard variant="soft" className="border-cyan-500/30 bg-cyan-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Capacidad total</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {tiers.length} tipo{tiers.length > 1 ? 's' : ''} de boleto
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-400">
                        {tiers.reduce((sum, t) => sum + (parseInt(t.maxQuantity) || 0), 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400">boletos disponibles</p>
                    </div>
                  </div>
                </GlassCard>
              </>
            )}

            {/* ========== UI para Eventos con Asientos ========== */}
            {eventType === "seated" && (
              <>
                {/* Precios por sección */}
                <div>
                  <h3 className="font-semibold text-white">Precios por sección</h3>
                  <p className="text-sm text-slate-400">
                    {venueSections.length > 0 
                      ? "Asigna un precio a cada sección. Los asientos de cada sección usarán el precio correspondiente." 
                      : venueZones.length > 0
                      ? "Asigna un precio a cada zona del layout." 
                      : "Selecciona un venue con layout para configurar precios por sección."}
                  </p>
                </div>

                {/* Section-based pricing - Editable list */}
                {venueSections.length > 0 && (
              <div className="space-y-3">
                {venueSections.map((section: any) => {
                  // Buscar por sectionId primero, luego por label como fallback
                  const sectionTier = tiers.find(t => t.sectionId === section.id)
                    || tiers.find(t => !t.sectionId && t.label.trim().toLowerCase() === section.name.trim().toLowerCase());
                  return (
                    <GlassCard key={section.id} variant="soft" className="border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-4">
                        {/* Section color indicator */}
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: section.color || '#3B82F6' }}
                        />
                        
                        {/* Section name */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{section.name}</p>
                          <p className="text-xs text-slate-400">{section.seatCount || 0} asientos</p>
                        </div>
                        
                        {/* Price input */}
                        <div className="flex items-center gap-2">
                          <div>
                            <Label className="text-[10px] text-slate-500">Precio base</Label>
                            <div className="relative w-28">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                              <Input
                                type="number"
                                value={sectionTier?.price || ""}
                                onChange={(e) => {
                                  const newPrice = e.target.value;
                                  if (sectionTier) {
                                    updateTier(sectionTier.clientId, { 
                                      price: newPrice,
                                      sectionId: section.id,
                                      label: section.name,
                                    });
                                  } else {
                                    const newTier = buildTier();
                                    newTier.sectionId = section.id;
                                    newTier.label = section.name;
                                    newTier.price = newPrice;
                                    newTier.fee = "0"; // Inicializar fee en 0
                                    setTiers((c) => [...c, newTier]);
                                  }
                                }}
                                className="pl-7 h-9 bg-white/5 border-white/20 text-white"
                                placeholder="0"
                                min={0}
                              />
                            </div>
                          </div>
                          
                          {/* Fee input */}
                          <div>
                            <Label className="text-[10px] text-slate-500">+ Fee</Label>
                            <div className="relative w-24">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                              <Input
                                type="number"
                                value={sectionTier?.fee || "0"}
                                onChange={(e) => {
                                  const newFee = e.target.value;
                                  if (sectionTier) {
                                    updateTier(sectionTier.clientId, { 
                                      fee: newFee,
                                    });
                                  } else if (parseFloat(e.target.value) > 0) {
                                    // Solo crear si hay un fee > 0
                                    const newTier = buildTier();
                                    newTier.sectionId = section.id;
                                    newTier.label = section.name;
                                    newTier.price = "0";
                                    newTier.fee = newFee;
                                    setTiers((c) => [...c, newTier]);
                                  }
                                }}
                                className="pl-7 h-9 bg-white/5 border-white/20 text-white"
                                placeholder="0"
                                min={0}
                              />
                            </div>
                          </div>
                          
                          {/* Total display */}
                          {sectionTier && (parseFloat(sectionTier.price) > 0 || parseFloat(sectionTier.fee || "0") > 0) && (
                            <div className="text-right">
                              <Label className="text-[10px] text-slate-500">Total</Label>
                              <p className="text-sm font-bold text-emerald-400">
                                ${(parseFloat(sectionTier.price || "0") + parseFloat(sectionTier.fee || "0")).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* Status indicator */}
                        {sectionTier && parseFloat(sectionTier.price) > 0 ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-0">
                            Listo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                            Sin precio
                          </Badge>
                        )}
                      </div>
                    </GlassCard>
                  );
                })}
                
                {/* Summary */}
                <GlassCard variant="soft" className="border-cyan-500/30 bg-cyan-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Resumen de precios</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {tiers.filter(t => t.sectionId && parseFloat(t.price) > 0).length} de {venueSections.length} secciones con precio
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Rango de precios</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {tiers.filter(t => t.sectionId && parseFloat(t.price) > 0).length > 0 
                          ? `$${Math.min(...tiers.filter(t => t.sectionId && parseFloat(t.price) > 0).map(t => parseFloat(t.price))).toLocaleString()} - $${Math.max(...tiers.filter(t => t.sectionId && parseFloat(t.price) > 0).map(t => parseFloat(t.price))).toLocaleString()}`
                          : '$0'
                        }
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </div>
            )}

            {/* Zone-based pricing (fallback if no sections) */}
            {venueSections.length === 0 && venueZones.length > 0 && (
              <div className="space-y-3">
                {venueZones.map((zone: any) => {
                  const zoneTier = tiers.find(t => t.zoneId === zone.id);
                  return (
                    <GlassCard key={zone.id} variant="soft" className="border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: zone.color || '#888' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{zone.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                            <Input
                              type="number"
                              value={zoneTier?.price || ""}
                              onChange={(e) => {
                                const newPrice = e.target.value;
                                if (zoneTier) {
                                  updateTier(zoneTier.clientId, { price: newPrice });
                                } else {
                                  const newTier = buildTier();
                                  newTier.zoneId = zone.id;
                                  newTier.label = zone.name;
                                  newTier.price = newPrice;
                                  setTiers((c) => [...c, newTier]);
                                }
                              }}
                              className="pl-7 h-9 bg-white/5 border-white/20 text-white"
                              placeholder="0"
                              min={0}
                            />
                          </div>
                          <span className="text-slate-400 text-sm">MXN</span>
                        </div>
                        {zoneTier && parseFloat(zoneTier.price) > 0 ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-0">
                            Listo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                            Sin precio
                          </Badge>
                        )}
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            )}

            {/* No sections or zones available - solo para seated */}
            {eventType === "seated" && venueSections.length === 0 && venueZones.length === 0 && (
              <GlassCard variant="soft" className="border-white/10 bg-white/5 p-8 text-center">
                <Layers className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">
                  El layout seleccionado no tiene secciones ni zonas definidas.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Vuelve al paso anterior y selecciona un layout con secciones para configurar precios.
                </p>
              </GlassCard>
            )}
              </>
            )}
          </div>
        );

      // ========== PASO 4: Media ==========
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-white">Imágenes del evento</h3>
              <p className="text-sm text-slate-400">
                Las imágenes ayudan a vender tu evento. Puedes agregarlas ahora o después.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Cover Image */}
              <div>
                <Label className="text-white">Imagen de portada</Label>
                <p className="mb-2 text-xs text-slate-400">Recomendado: 1920x1080px, formato 16:9</p>
                <div 
                  className={cn(
                    "relative flex aspect-video cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed transition-colors",
                    media.coverImage 
                      ? "border-transparent" 
                      : "border-white/20 hover:border-white/40 hover:bg-white/5"
                  )}
                  onClick={() => document.getElementById("cover-upload")?.click()}
                >
                  {media.coverImage ? (
                    <>
                      <img 
                        src={media.coverImage} 
                        alt="Cover" 
                        className="h-full w-full rounded-2xl object-cover"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 bg-black/50 text-white hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMedia((p) => ({ ...p, coverImage: "" }));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="text-center text-slate-400">
                      <Upload className="mx-auto mb-2 h-8 w-8" />
                      <p className="text-sm">Click para subir</p>
                    </div>
                  )}
                </div>
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, "coverImage");
                  }}
                />
              </div>

              {/* Thumbnail */}
              <div>
                <Label className="text-white">Thumbnail (miniatura)</Label>
                <p className="mb-2 text-xs text-slate-400">Recomendado: 400x400px, formato cuadrado</p>
                <div 
                  className={cn(
                    "relative flex aspect-square cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed transition-colors",
                    media.thumbnailImage 
                      ? "border-transparent" 
                      : "border-white/20 hover:border-white/40 hover:bg-white/5"
                  )}
                  onClick={() => document.getElementById("thumb-upload")?.click()}
                >
                  {media.thumbnailImage ? (
                    <>
                      <img 
                        src={media.thumbnailImage} 
                        alt="Thumbnail" 
                        className="h-full w-full rounded-2xl object-cover"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 bg-black/50 text-white hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMedia((p) => ({ ...p, thumbnailImage: "" }));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="text-center text-slate-400">
                      <Upload className="mx-auto mb-2 h-8 w-8" />
                      <p className="text-sm">Click para subir</p>
                    </div>
                  )}
                </div>
                <input
                  id="thumb-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, "thumbnailImage");
                  }}
                />
              </div>
            </div>

            {/* Video URL */}
            <div>
              <Label className="text-white">Video promocional (YouTube/Vimeo)</Label>
              <Input
                value={media.videoUrl}
                onChange={(e) => setMedia((p) => ({ ...p, videoUrl: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
                className="mt-2 border-white/20 bg-white/5 text-white"
              />
            </div>
          </div>
        );

      // ========== PASO 5: Resumen ==========
      default:
        const selectedCategory = categories.find(c => c.id === basics.categoryId);
        const selectedVenue = venues?.find(v => v.id === venueId);
        
        return (
          <div className="space-y-6">
            {/* Header del evento */}
            <GlassCard variant="soft" className="border-white/10 bg-white/5 p-6">
              <div className="flex gap-6">
                {media.thumbnailImage && (
                  <img 
                    src={media.thumbnailImage} 
                    alt="" 
                    className="h-32 w-32 rounded-2xl object-cover"
                  />
                )}
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    {selectedCategory && (
                      <span 
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ 
                          backgroundColor: `${selectedCategory.color}20`, 
                          color: selectedCategory.color 
                        }}
                      >
                        {selectedCategory.name}
                      </span>
                    )}
                    {basics.isFeatured && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                        <Star className="h-3 w-3" />
                        Destacado
                      </span>
                    )}
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      basics.status === "PUBLISHED" 
                        ? "bg-emerald-500/20 text-emerald-300" 
                        : "bg-slate-500/20 text-slate-300"
                    )}>
                      {basics.status === "PUBLISHED" ? "Publicado" : "Borrador"}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">{basics.name}</h2>
                  {basics.artistName && (
                    <p className="text-lg text-slate-300">{basics.artistName}</p>
                  )}
                  {basics.shortDescription && (
                    <p className="mt-2 text-sm text-slate-400">{basics.shortDescription}</p>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* Info Grid */}
            <div className="grid gap-4 md:grid-cols-3">
              <GlassCard variant="soft" className="border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-500/20 p-2">
                    <MapPin className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Venue</p>
                    <p className="font-medium text-white">{selectedVenue?.name || "—"}</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard variant="soft" className="border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-violet-500/20 p-2">
                    <Calendar className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Funciones</p>
                    <p className="font-medium text-white">{sessions.length}</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard variant="soft" className="border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-500/20 p-2">
                    <DollarSign className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Tarifas</p>
                    <p className="font-medium text-white">{tiers.length}</p>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Sesiones */}
            <div>
              <h3 className="mb-3 font-semibold text-white">Funciones programadas</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {sessions.map((session, index) => (
                  <div 
                    key={session.clientId} 
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-sm font-bold text-violet-300">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-white">{session.title || `Función ${index + 1}`}</p>
                      {session.startsAt && (
                        <p className="text-sm text-slate-400">
                          {new Date(session.startsAt).toLocaleString("es-MX", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Precios */}
            <div>
              <h3 className="mb-3 font-semibold text-white">Tarifas de boletos</h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {tiers.map((tier) => {
                  const zone = venueZones.find((z: any) => z.id === tier.zoneId);
                  return (
                    <div 
                      key={tier.clientId} 
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        {zone && (
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ backgroundColor: zone.color || "#888" }} 
                          />
                        )}
                        <p className="font-medium text-white">{tier.label}</p>
                      </div>
                      <p className="text-2xl font-bold text-emerald-400">
                        ${Number(tier.price).toLocaleString("es-MX")}
                        <span className="text-sm font-normal text-slate-400"> MXN</span>
                      </p>
                      {Number(tier.fee) > 0 && (
                        <p className="text-xs text-slate-500">+ ${tier.fee} cargo</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Warning si es borrador */}
            {basics.status === "DRAFT" && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-400" />
                <div>
                  <p className="font-medium text-amber-200">El evento se creará como borrador</p>
                  <p className="text-sm text-amber-200/70">
                    No será visible públicamente hasta que lo publiques desde el panel de administración.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  // ========== Render Principal ==========
  return (
    <div className="space-y-6 px-2 py-4 text-white lg:px-0">
      {/* Header */}
      <div className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-6 backdrop-blur-2xl">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Nuevo evento</p>
        <h1 className="text-3xl font-semibold">Crear evento</h1>
        <p className="text-slate-300">Completa la información para publicar tu evento.</p>
      </div>

      {/* Wizard */}
      <GlassCard variant="intense" className="space-y-6 border-white/10 bg-white/10 px-8 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
          {steps.map((s, index) => {
            const Icon = s.icon;
            const isActive = index === step;
            const isComplete = index < step;
            
            return (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => index < step && setStep(index)}
                  disabled={index > step}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl px-3 py-2 transition-all",
                    isActive && "bg-white/15 text-white",
                    isComplete && "cursor-pointer text-emerald-300 hover:bg-white/10",
                    !isActive && !isComplete && "text-slate-500"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                    isActive && "bg-cyan-500/20 text-cyan-400",
                    isComplete && "bg-emerald-500/20 text-emerald-400",
                    !isActive && !isComplete && "bg-white/5"
                  )}>
                    {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="hidden text-sm font-medium md:block">{s.label}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "h-px w-8 transition-colors",
                    isComplete ? "bg-emerald-500/50" : "bg-white/10"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-white/10 pt-6">
          <Button 
            variant="ghost" 
            className="text-slate-300" 
            disabled={step === 0 || submitting} 
            onClick={() => setStep((v) => Math.max(0, v - 1))}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>

          <div className="flex gap-3">
            {step === steps.length - 1 ? (
              <Button 
                onClick={handleSubmit} 
                disabled={!canSubmit || submitting} 
                className="bg-gradient-to-r from-cyan-500 to-violet-500 px-8 hover:from-cyan-600 hover:to-violet-600"
              >
                {submitting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Coins className="mr-2 h-4 w-4" />
                    Crear evento
                  </>
                )}
              </Button>
            ) : (
              <Button 
                onClick={() => setStep((v) => Math.min(steps.length - 1, v + 1))} 
                disabled={!canProceed}
                className="px-8"
              >
                Continuar
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Modal Crear Artista */}
      <Dialog open={showCreateArtist} onOpenChange={setShowCreateArtist}>
        <DialogContent className="border-white/20 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <UserCircle className="h-5 w-5 text-[#ffc800]" />
              Nuevo Artista
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-white">Nombre del artista *</Label>
              <Input
                value={newArtist.name}
                onChange={(e) => setNewArtist((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Bad Bunny, Coldplay"
                className="mt-2 border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <Label className="text-white">Género musical</Label>
              <Input
                value={newArtist.genre}
                onChange={(e) => setNewArtist((p) => ({ ...p, genre: e.target.value }))}
                placeholder="Ej: Reggaeton, Rock, Pop"
                className="mt-2 border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <Label className="text-white">Biografía</Label>
              <Textarea
                value={newArtist.bio}
                onChange={(e) => setNewArtist((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Breve descripción del artista..."
                className="mt-2 min-h-[80px] border-white/20 bg-white/5 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCreateArtist(false)}
              className="text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateArtist}
              disabled={!newArtist.name.trim() || creatingArtist}
              className="bg-[#ffc800] text-black hover:bg-[#ffc800]/90"
            >
              {creatingArtist ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Artista
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Crear Playlist */}
      <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
        <DialogContent className="border-white/20 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ListMusic className="h-5 w-5 text-[#ffc800]" />
              Nueva Playlist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-white">Nombre de la playlist *</Label>
              <Input
                value={newPlaylist.name}
                onChange={(e) => setNewPlaylist((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Pre-show Mix, Concierto Hits"
                className="mt-2 border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <Label className="text-white">Descripción</Label>
              <Textarea
                value={newPlaylist.description}
                onChange={(e) => setNewPlaylist((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descripción de la playlist..."
                className="mt-2 min-h-[80px] border-white/20 bg-white/5 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCreatePlaylist(false)}
              className="text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreatePlaylist}
              disabled={!newPlaylist.name.trim() || creatingPlaylist}
              className="bg-[#ffc800] text-black hover:bg-[#ffc800]/90"
            >
              {creatingPlaylist ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Playlist
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEventCreate;
