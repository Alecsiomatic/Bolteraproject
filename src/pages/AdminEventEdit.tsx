import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useVenues } from "@/hooks/useVenues";
import { useVenueLayouts } from "@/hooks/useVenueLayouts";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit,
  Image,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Save,
  Tag,
  Trash2,
  Upload,
  Users,
  DollarSign,
  AlertTriangle,
  Coins,
  AlertCircle,
  CheckCircle2,
  X,
  Music,
  ListMusic,
  UserCircle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-base";

const eventStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const sessionStatuses = ["SCHEDULED", "SALES_OPEN", "SOLD_OUT", "CANCELLED"] as const;
const eventTypes = ["seated", "general", "hybrid"] as const;
const serviceFeeTypes = ["percentage", "fixed"] as const;
const stagePositions = ["top", "bottom", "left", "right"] as const;

interface EventSession {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  capacity: number | null;
  ticketsSold?: number;
}

interface PriceTier {
  id: string;
  label: string;
  description: string | null;
  price: number;
  fee: number;
  currency: string;
  zoneId: string | null;
  zoneName?: string;
  sectionId: string | null;
  sectionName?: string;
  sessionId: string | null;
  isDefault: boolean;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  capacity?: number | null;
  isGeneralAdmission?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface LayoutSection {
  id: string;
  name: string;
  color?: string;
  seatCount?: number;
  admissionType?: "seated" | "general";
  capacity?: number;
}

interface EventData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  status: string;
  isFeatured: boolean;
  venueId: string;
  venueName?: string;
  layoutId?: string | null;
  layoutName?: string;
  categoryId: string | null;
  categoryName?: string;
  thumbnailImage: string | null;
  coverImage: string | null;
  eventType?: string;
  serviceFeeType?: string | null;
  serviceFeeValue?: number | null;
  showRemainingTickets?: boolean;
  stagePosition?: string;
  sessions: EventSession[];
  priceTiers: PriceTier[];
  createdAt: string;
  updatedAt: string;
}

const dedupeSectionTiers = (tiers: PriceTier[]): PriceTier[] => {
  if (!tiers || tiers.length === 0) return [];

  const sorted = [...tiers].sort((a, b) => {
    const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    return bTime - aTime;
  });

  const seenSections = new Set<string>();
  const result: PriceTier[] = [];

  for (const tier of sorted) {
    if (tier.sectionId) {
      if (seenSections.has(tier.sectionId)) continue;
      seenSections.add(tier.sectionId);
    }
    result.push(tier);
  }

  return result;
};

export default function AdminEventEdit() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { toast: toastUI } = useToast();
  const { token } = useAuth();
  const { data: venues } = useVenues();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState<EventData | null>(null);
  const [activeTab, setActiveTab] = useState("details");

  // Form states
  const [details, setDetails] = useState({
    name: "",
    description: "",
    shortDescription: "",
    status: "DRAFT" as string,
    isFeatured: false,
    categoryId: "",
  });
  const [venueId, setVenueId] = useState("");
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  
  // Event type and service fee
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>("seated");
  const [serviceFee, setServiceFee] = useState({
    type: "" as (typeof serviceFeeTypes)[number] | "",
    value: "",
  });
  const [showRemainingTickets, setShowRemainingTickets] = useState(false);
  const [stagePosition, setStagePosition] = useState<(typeof stagePositions)[number]>("top");

  // New tier form state
  const [newTierForm, setNewTierForm] = useState({
    open: false,
    label: "",
    price: "",
    fee: "",
    capacity: "",
    description: "",
  });

  // Dialogs
  const [sessionDialog, setSessionDialog] = useState<{ open: boolean; session: EventSession | null }>({
    open: false,
    session: null,
  });

  // Categories
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  // Artist & Playlist selection
  const [artistId, setArtistId] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [artists, setArtists] = useState<Array<{ id: string; name: string; genre?: string }>>([]);
  const [playlists, setPlaylists] = useState<Array<{ id: string; name: string }>>([]);
  const [showCreateArtist, setShowCreateArtist] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newArtist, setNewArtist] = useState({ name: "", genre: "", bio: "" });
  const [newPlaylist, setNewPlaylist] = useState({ name: "", description: "" });
  const [creatingArtist, setCreatingArtist] = useState(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  // Venue layouts
  const { data: venueLayouts } = useVenueLayouts(venueId);
  
  // Sections del layout seleccionado
  const [layoutSections, setLayoutSections] = useState<LayoutSection[]>([]);

  useEffect(() => {
    fetchEvent();
    fetchCategories();
    fetchArtistsAndPlaylists();
  }, [eventId]);

  // Fetch artists and playlists
  const fetchArtistsAndPlaylists = async () => {
    try {
      // Fetch artists
      const artistsRes = await fetch(`${API_BASE_URL}/api/artists?active=true`);
      if (artistsRes.ok) {
        const artistsData = await artistsRes.json();
        setArtists(artistsData.artists || artistsData || []);
      }
      
      // Fetch playlists
      const playlistsRes = await fetch(`${API_BASE_URL}/api/playlists?active=true`);
      if (playlistsRes.ok) {
        const playlistsData = await playlistsRes.json();
        setPlaylists(playlistsData.playlists || playlistsData || []);
      }
    } catch (err) {
      console.error("Error fetching artists/playlists:", err);
    }
  };

  // Create new artist handler
  const handleCreateArtist = async () => {
    if (!newArtist.name.trim()) return;
    setCreatingArtist(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/artists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newArtist.name.trim(),
          genre: newArtist.genre?.trim() || null,
          bio: newArtist.bio?.trim() || null,
        }),
      });
      if (!response.ok) throw new Error("Error al crear artista");
      const created = await response.json();
      setArtists((prev) => [...prev, created]);
      setArtistId(created.id);
      setShowCreateArtist(false);
      setNewArtist({ name: "", genre: "", bio: "" });
      toast.success("Artista creado correctamente");
    } catch (err) {
      toast.error("Error al crear artista");
    } finally {
      setCreatingArtist(false);
    }
  };

  // Create new playlist handler
  const handleCreatePlaylist = async () => {
    if (!newPlaylist.name.trim()) return;
    setCreatingPlaylist(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/playlists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newPlaylist.name.trim(),
          description: newPlaylist.description?.trim() || null,
        }),
      });
      if (!response.ok) throw new Error("Error al crear playlist");
      const created = await response.json();
      setPlaylists((prev) => [...prev, created]);
      setPlaylistId(created.id);
      setShowCreatePlaylist(false);
      setNewPlaylist({ name: "", description: "" });
      toast.success("Playlist creada correctamente");
    } catch (err) {
      toast.error("Error al crear playlist");
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // Limpiar tiers cuando se cambia a admisión general
  useEffect(() => {
    if (eventType === "general" && tiers.some(t => t.sectionId || t.zoneId)) {
      // Solo mantener tiers que no estén vinculados a secciones o zonas
      setTiers(prev => prev.filter(t => !t.sectionId && !t.zoneId));
    }
  }, [eventType]);

  // Cargar secciones cuando cambia el layout
  useEffect(() => {
    const fetchLayoutSections = async () => {
      if (!venueId || !layoutId) {
        setLayoutSections([]);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/api/venues/${venueId}/layouts/${layoutId}`);
        if (response.ok) {
          const data = await response.json();
          setLayoutSections(data.sections || []);
        }
      } catch (err) {
        console.error("Error fetching layout sections:", err);
        setLayoutSections([]);
      }
    };
    fetchLayoutSections();
  }, [venueId, layoutId]);

  const fetchEvent = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Evento no encontrado");
      const data = await response.json();

      setEvent(data);
      setDetails({
        name: data.name || "",
        description: data.description || "",
        shortDescription: data.shortDescription || "",
        status: data.status || "DRAFT",
        isFeatured: data.isFeatured || false,
        categoryId: data.categoryId || "",
      });
      setVenueId(data.venueId || "");
      setLayoutId(data.layoutId || null);
      setSessions(data.sessions || []);
      setTiers(dedupeSectionTiers(data.priceTiers || []));
      setEventType(data.eventType || "seated");
      setServiceFee({
        type: data.serviceFeeType || "",
        value: data.serviceFeeValue ? String(data.serviceFeeValue) : "",
      });
      setShowRemainingTickets(Boolean(data.showRemainingTickets));
      setStagePosition((data.stagePosition as (typeof stagePositions)[number]) || "top");
      // Artist & Playlist
      setArtistId(data.artistId || data.artist?.id || "");
      setPlaylistId(data.playlistId || data.playlist?.id || "");
    } catch (err) {
      toast.error("Error al cargar el evento");
      navigate("/admin/events");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const cats = await api.listCategories(true);
      setCategories(cats.map((c) => ({ id: c.id, name: c.name })));
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const handleSaveDetails = async () => {
    if (!eventId) return;
    setSaving(true);
    try {
      // Detectar automáticamente si es híbrido basándose en los tiers
      let finalEventType = eventType;
      if (eventType === "seated" || eventType === "hybrid") {
        const hasSeatedTiers = tiers.some(t => !t.isGeneralAdmission);
        const hasGATiers = tiers.some(t => t.isGeneralAdmission);
        if (hasSeatedTiers && hasGATiers) {
          finalEventType = "hybrid";
        }
      }
      
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: details.name,
          description: details.description || null,
          shortDescription: details.shortDescription || null,
          status: details.status,
          isFeatured: details.isFeatured,
          categoryId: details.categoryId || null,
          venueId,
          layoutId: (finalEventType === "seated" || finalEventType === "hybrid") ? layoutId : null,
          eventType: finalEventType,
          serviceFeeType: serviceFee.type || null,
          serviceFeeValue: serviceFee.value ? Number(serviceFee.value) : null,
          showRemainingTickets: finalEventType === "general" ? showRemainingTickets : false,
          stagePosition: (finalEventType === "seated" || finalEventType === "hybrid") ? stagePosition : null,
          artistId: artistId || null,
          playlistId: playlistId || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Error al guardar");
      }

      toast.success("Evento actualizado correctamente");
      fetchEvent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // Session CRUD
  const handleSaveSession = async (session: EventSession) => {
    setSaving(true);
    try {
      const isNew = !session.id || session.id.startsWith("new-");
      const url = isNew
        ? `${API_BASE_URL}/api/events/${eventId}/sessions`
        : `${API_BASE_URL}/api/events/${eventId}/sessions/${session.id}`;

      // Convert datetime-local format to ISO 8601
      const formatDateToISO = (dateStr: string | null): string | null => {
        if (!dateStr) return null;
        // If already has timezone info, return as is
        if (dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('-', 10)) {
          return dateStr;
        }
        // datetime-local gives us YYYY-MM-DDTHH:mm, add seconds and Z
        return new Date(dateStr).toISOString();
      };

      const response = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: session.title || null,
          startsAt: formatDateToISO(session.startsAt),
          endsAt: formatDateToISO(session.endsAt),
          status: session.status,
          capacity: session.capacity || null,
        }),
      });

      if (!response.ok) throw new Error("Error al guardar sesión");

      toast.success(isNew ? "Sesión creada" : "Sesión actualizada");
      setSessionDialog({ open: false, session: null });
      fetchEvent();
    } catch (err) {
      toast.error("Error al guardar la sesión");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/sessions/${sessionId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Error al eliminar");

      toast.success("Sesión eliminada");
      fetchEvent();
    } catch (err) {
      toast.error("No se pudo eliminar la sesión");
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/tiers/${tierId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Error al eliminar");

      toast.success("Precio eliminado");
      fetchEvent();
    } catch (err) {
      toast.error("No se pudo eliminar el precio");
    }
  };

  // Handle section price change - creates or updates tier for a section
  const handleSectionPriceChange = async (section: LayoutSection, price: number, fee: number = 0) => {
    const { id: sectionId, name: sectionName, admissionType, capacity } = section;
    const isGeneralAdmission = admissionType === "general";
    
    // Buscar tier existente por sectionId primero, luego por label como fallback
    const existingTier = tiers.find(t => t.sectionId === sectionId) 
      || tiers.find(t => !t.sectionId && t.label.trim().toLowerCase() === sectionName.trim().toLowerCase());
    
    try {
      if (existingTier) {
        // Update existing tier - también actualizar sectionId si no lo tenía
        const updatePayload: { 
          price: number; 
          fee: number; 
          sectionId?: string; 
          label?: string;
          isGeneralAdmission?: boolean;
          capacity?: number | null;
        } = { price, fee, isGeneralAdmission };
        
        // Si el tier no tenía sectionId, agregarlo ahora para vincular correctamente
        if (!existingTier.sectionId) {
          updatePayload.sectionId = sectionId;
          updatePayload.label = sectionName; // Actualizar label por si acaso
        }
        
        // Para GA, enviar capacidad
        if (isGeneralAdmission && capacity) {
          updatePayload.capacity = capacity;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/tiers/${existingTier.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(updatePayload),
        });
        
        if (!response.ok) throw new Error("Error al actualizar precio");
        
        // Update local state immediately for better UX
        setTiers(prev => prev.map(t => 
          t.id === existingTier.id 
            ? { 
                ...t, 
                price, 
                fee, 
                sectionId: updatePayload.sectionId || t.sectionId, 
                sectionName, 
                isGeneralAdmission,
                capacity: isGeneralAdmission ? capacity : t.capacity,
                updatedAt: new Date().toISOString(),
              } 
            : t
        ));
      } else if (price > 0 || fee > 0) {
        // Create new tier for this section
        const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/tiers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            label: sectionName,
            price,
            fee,
            currency: "MXN",
            sectionId,
            isDefault: false,
            isGeneralAdmission,
            capacity: isGeneralAdmission ? capacity : null,
          }),
        });
        
        if (!response.ok) throw new Error("Error al crear precio");
        
        const newTier = await response.json();
        // Add to local state
        setTiers(prev => [...prev, {
          id: newTier.id,
          label: sectionName,
          description: null,
          price,
          fee,
          currency: "MXN",
          zoneId: null,
          sectionId,
          sectionName,
          sessionId: null,
          isDefault: false,
          isGeneralAdmission,
          capacity: isGeneralAdmission ? capacity : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      toast.error("Error al guardar el precio");
      // Refresh to get correct state
      fetchEvent();
    }
  };

  // Image upload
  const handleImageUpload = async (type: "thumbnail" | "cover", file: File) => {
    try {
      const { url } = await api.uploadImage("events", file);

      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          [type === "thumbnail" ? "thumbnailImage" : "coverImage"]: url,
        }),
      });

      if (!response.ok) throw new Error("Error al actualizar imagen");

      toast.success("Imagen actualizada");
      fetchEvent();
    } catch (err) {
      toast.error("Error al subir la imagen");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Evento no encontrado</p>
        <Button onClick={() => navigate("/admin/events")} className="mt-4">
          Volver a eventos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin/events")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">{event.name}</h1>
            <p className="text-slate-400">Editando evento</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={event.status === "PUBLISHED" ? "default" : "secondary"}
            className={
              event.status === "PUBLISHED"
                ? "bg-emerald-500/20 text-emerald-300"
                : event.status === "DRAFT"
                ? "bg-amber-500/20 text-amber-300"
                : "bg-slate-500/20 text-slate-300"
            }
          >
            {event.status === "PUBLISHED" ? "Publicado" : event.status === "DRAFT" ? "Borrador" : "Archivado"}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5">
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="sessions">Sesiones ({sessions.length})</TabsTrigger>
          <TabsTrigger value="pricing">Precios ({tiers.length})</TabsTrigger>
          <TabsTrigger value="images">Imágenes</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Información General</CardTitle>
              <CardDescription>Datos básicos del evento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre del evento *</Label>
                  <Input
                    value={details.name}
                    onChange={(e) => setDetails({ ...details, name: e.target.value })}
                    placeholder="Nombre del evento"
                    className="border-white/20 bg-white/5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={details.status}
                    onValueChange={(v) => setDetails({ ...details, status: v })}
                  >
                    <SelectTrigger className="border-white/20 bg-white/5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Borrador</SelectItem>
                      <SelectItem value="PUBLISHED">Publicado</SelectItem>
                      <SelectItem value="ARCHIVED">Archivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select
                    value={details.categoryId || "__none__"}
                    onValueChange={(v) => setDetails({ ...details, categoryId: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger className="border-white/20 bg-white/5">
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin categoría</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Select value={venueId} onValueChange={(v) => {
                    setVenueId(v);
                    setLayoutId(null); // Reset layout when venue changes
                  }}>
                    <SelectTrigger className="border-white/20 bg-white/5">
                      <SelectValue placeholder="Selecciona venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues?.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Artist & Playlist Selection */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-[#ffc800]" />
                    Artista / Presentador *
                  </Label>
                  <div className="flex gap-2">
                    <Select value={artistId} onValueChange={setArtistId}>
                      <SelectTrigger className="flex-1 border-white/20 bg-white/5">
                        <SelectValue placeholder="Selecciona artista">
                          {artistId && artists.find(a => a.id === artistId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
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
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ListMusic className="h-4 w-4 text-[#ffc800]" />
                    Playlist de música
                  </Label>
                  <div className="flex gap-2">
                    <Select value={playlistId || "__none__"} onValueChange={(v) => setPlaylistId(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="flex-1 border-white/20 bg-white/5">
                        <SelectValue placeholder="Sin playlist (opcional)">
                          {playlistId && playlists.find(p => p.id === playlistId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <div className="flex items-center gap-2 text-slate-400">
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
              </div>

              {/* Event Type Selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tipo de evento
                </Label>
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setEventType("seated")}
                    className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                      eventType === "seated"
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-white/20 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className={`h-5 w-5 ${eventType === "seated" ? "text-cyan-400" : "text-slate-400"}`} />
                      <span className={`font-medium ${eventType === "seated" ? "text-white" : "text-slate-300"}`}>
                        Con mapa de asientos
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Usuarios seleccionan asiento en el mapa
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventType("general")}
                    className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                      eventType === "general"
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-white/20 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className={`h-5 w-5 ${eventType === "general" ? "text-cyan-400" : "text-slate-400"}`} />
                      <span className={`font-medium ${eventType === "general" ? "text-white" : "text-slate-300"}`}>
                        Admisión general
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Sin selección de asiento, compra por cantidad
                    </p>
                  </button>
                </div>
              </div>

              {/* Service Fee */}
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-400" />
                    Cargo de servicio global
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo de cargo</Label>
                      <Select
                        value={serviceFee.type || "__none__"}
                        onValueChange={(v) => setServiceFee({ ...serviceFee, type: v === "__none__" ? "" : v as (typeof serviceFeeTypes)[number] })}
                      >
                        <SelectTrigger className="border-white/20 bg-white/5">
                          <SelectValue placeholder="Sin cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin cargo de servicio</SelectItem>
                          <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                          <SelectItem value="fixed">Monto fijo ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {serviceFee.type && (
                      <div className="space-y-1">
                        <Label className="text-xs">{serviceFee.type === "percentage" ? "Porcentaje" : "Monto"}</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            step={serviceFee.type === "percentage" ? "0.1" : "1"}
                            value={serviceFee.value}
                            onChange={(e) => setServiceFee({ ...serviceFee, value: e.target.value })}
                            placeholder={serviceFee.type === "percentage" ? "10" : "50"}
                            className="border-white/20 bg-white/5 pr-12"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                            {serviceFee.type === "percentage" ? "%" : "MXN"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Layout selector - Solo para eventos seated */}
              {venueId && eventType === "seated" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Layout del evento
                  </Label>
                  <Select 
                    value={layoutId || "__default__"} 
                    onValueChange={(v) => setLayoutId(v === "__default__" ? null : v)}
                  >
                    <SelectTrigger className="border-white/20 bg-white/5">
                      <SelectValue placeholder="Usar layout por defecto del venue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">Layout por defecto del venue</span>
                        </span>
                      </SelectItem>
                      {venueLayouts?.map((layout) => (
                        <SelectItem key={layout.id} value={layout.id}>
                          <span className="flex items-center gap-2">
                            {layout.name}
                            {layout.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                            {layout.isTemplate && <Badge variant="outline" className="text-xs">Template</Badge>}
                            <span className="text-muted-foreground text-xs">
                              ({layout.seatCount || 0} asientos)
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecciona un layout específico o deja por defecto para usar el layout principal del venue.
                  </p>
                </div>
              )}

              {/* Selector de posición del escenario - DESPUÉS del layout */}
              {eventType === "seated" && (
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-lg">🎭</span>
                      Posición del escenario
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Indica dónde se ubica el escenario respecto al mapa de asientos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
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
                          className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                            stagePosition === pos.value
                              ? "border-amber-500 bg-amber-500/30 text-white"
                              : "border-white/20 bg-white/5 text-slate-400 hover:border-white/30"
                          }`}
                        >
                          <span className="text-lg">{pos.icon}</span>
                          <span className="text-xs font-medium">{pos.label}</span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Info para admisión general */}
              {venueId && eventType === "general" && (
                <Card className="border-blue-500/20 bg-blue-500/5">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-white">Evento sin mapa de asientos</p>
                        <p className="text-sm text-slate-300 mt-1">
                          Los boletos se venderán por cantidad. Configura los tipos de boleto y capacidad en la pestaña <strong>Precios</strong>.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                      <div>
                        <p className="text-sm font-medium text-white">Mostrar boletos restantes</p>
                        <p className="text-xs text-blue-100/80">Controla si los compradores ven cuántos boletos quedan disponibles.</p>
                      </div>
                      <Switch
                        checked={showRemainingTickets}
                        onCheckedChange={setShowRemainingTickets}
                        aria-label="Mostrar boletos restantes"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label>Descripción corta</Label>
                <Input
                  value={details.shortDescription}
                  onChange={(e) => setDetails({ ...details, shortDescription: e.target.value })}
                  placeholder="Breve descripción para listados"
                  className="border-white/20 bg-white/5"
                />
              </div>

              <div className="space-y-2">
                <Label>Descripción completa</Label>
                <Textarea
                  value={details.description}
                  onChange={(e) => setDetails({ ...details, description: e.target.value })}
                  placeholder="Descripción detallada del evento"
                  className="border-white/20 bg-white/5 min-h-[120px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={details.isFeatured}
                  onCheckedChange={(v) => setDetails({ ...details, isFeatured: v })}
                />
                <Label>Evento destacado</Label>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveDetails} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Sesiones del evento</h3>
            <Button
              onClick={() =>
                setSessionDialog({
                  open: true,
                  session: {
                    id: `new-${Date.now()}`,
                    title: "",
                    startsAt: "",
                    endsAt: null,
                    status: "SCHEDULED",
                    capacity: null,
                  },
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva sesión
            </Button>
          </div>

          <div className="grid gap-4">
            {sessions.length === 0 ? (
              <Card className="border-white/10 bg-white/5">
                <CardContent className="py-8 text-center">
                  <Calendar className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">No hay sesiones configuradas</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() =>
                      setSessionDialog({
                        open: true,
                        session: {
                          id: `new-${Date.now()}`,
                          title: "",
                          startsAt: "",
                          endsAt: null,
                          status: "SCHEDULED",
                          capacity: null,
                        },
                      })
                    }
                  >
                    Agregar primera sesión
                  </Button>
                </CardContent>
              </Card>
            ) : (
              sessions.map((session) => (
                <Card key={session.id} className="border-white/10 bg-white/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-cyan-500/20">
                          <Calendar className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {session.title || "Función"}
                          </p>
                          <p className="text-sm text-slate-400">
                            {session.startsAt
                              ? format(new Date(session.startsAt), "EEEE d 'de' MMMM, yyyy 'a las' HH:mm", {
                                  locale: es,
                                })
                              : "Sin fecha"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={
                            session.status === "SALES_OPEN"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : session.status === "SOLD_OUT"
                              ? "bg-red-500/20 text-red-300"
                              : "bg-slate-500/20 text-slate-300"
                          }
                        >
                          {session.status === "SCHEDULED"
                            ? "Programada"
                            : session.status === "SALES_OPEN"
                            ? "Ventas abiertas"
                            : session.status === "SOLD_OUT"
                            ? "Agotada"
                            : "Cancelada"}
                        </Badge>
                        {session.capacity && (
                          <span className="text-sm text-slate-400">
                            <Users className="h-3 w-3 inline mr-1" />
                            {session.capacity}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSessionDialog({ open: true, session })}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar sesión?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Los boletos asociados también se eliminarán.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSession(session.id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">
              {eventType === "seated" ? "Precios por sección" : "Tipos de boleto"}
            </h3>
          </div>

          {/* ADMISIÓN GENERAL - Manual tier creation */}
          {eventType === "general" && (
            <div className="space-y-4">
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-white">Evento de admisión general</p>
                      <p className="text-sm text-slate-300 mt-1">
                        Crea diferentes tipos de boletos con sus capacidades y precios. No se asignan asientos específicos.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* List existing tiers */}
              {tiers.length > 0 && (
                <div className="space-y-3">
                  {tiers.map((tier) => (
                    <Card key={tier.id} className="border-white/10 bg-white/5">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <p className="font-medium text-white">{tier.label}</p>
                            {tier.description && (
                              <p className="text-xs text-slate-400 mt-1">{tier.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-slate-400">Precio base</p>
                              <p className="text-sm font-medium text-white">${tier.price.toLocaleString()}</p>
                            </div>
                            {tier.fee > 0 && (
                              <div className="text-right">
                                <p className="text-xs text-slate-400">Fee</p>
                                <p className="text-sm font-medium text-white">${tier.fee.toLocaleString()}</p>
                              </div>
                            )}
                            <div className="text-right">
                              <p className="text-xs text-slate-400">Capacidad</p>
                              <p className="text-sm font-medium text-white">
                                {tier.capacity !== null && tier.capacity !== undefined
                                  ? tier.capacity.toLocaleString()
                                  : "Ilimitado"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-400">Total</p>
                              <p className="text-sm font-bold text-emerald-400">
                                ${(tier.price + tier.fee).toLocaleString()}
                              </p>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-red-400" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar tipo de boleto?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará el tipo "{tier.label}". Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(
                                          `${API_BASE_URL}/api/events/${eventId}/tiers/${tier.id}`,
                                          {
                                            method: "DELETE",
                                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                                          }
                                        );
                                        if (!response.ok) throw new Error("Error al eliminar");
                                        setTiers(prev => prev.filter(t => t.id !== tier.id));
                                        toastUI({ title: "Tipo de boleto eliminado" });
                                      } catch {
                                        toastUI({ 
                                          title: "Error", 
                                          description: "No se pudo eliminar el tipo de boleto",
                                          variant: "destructive" 
                                        });
                                      }
                                    }}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Add new tier form */}
              {!newTierForm.open ? (
                <Button
                  onClick={() => setNewTierForm({ open: true, label: "", price: "", fee: "", capacity: "", description: "" })}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar tipo de boleto
                </Button>
              ) : (
                <Card className="border-emerald-500/30 bg-emerald-500/5">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-white">Nuevo tipo de boleto</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setNewTierForm({ open: false, label: "", price: "", fee: "", capacity: "", description: "" })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-white">Nombre del tipo</Label>
                        <Input
                          value={newTierForm.label}
                          onChange={(e) => setNewTierForm(prev => ({ ...prev, label: e.target.value }))}
                          placeholder="ej: General, VIP, Estudiante"
                          className="bg-white/5 border-white/20"
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <Label className="text-white">Precio base</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <Input
                              type="number"
                              value={newTierForm.price}
                              onChange={(e) => setNewTierForm(prev => ({ ...prev, price: e.target.value }))}
                              placeholder="0"
                              className="pl-7 bg-white/5 border-white/20"
                              min={0}
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-white">Capacidad</Label>
                          <Input
                            type="number"
                            value={newTierForm.capacity}
                            onChange={(e) => setNewTierForm(prev => ({ ...prev, capacity: e.target.value }))}
                            placeholder="Ilimitado"
                            className="bg-white/5 border-white/20"
                            min={0}
                          />
                          <p className="text-[11px] text-slate-500 mt-1">Deja vacío para ilimitado</p>
                        </div>

                        <div>
                          <Label className="text-white">Fee (opcional)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <Input
                              type="number"
                              value={newTierForm.fee}
                              onChange={(e) => setNewTierForm(prev => ({ ...prev, fee: e.target.value }))}
                              placeholder="0"
                              className="pl-7 bg-white/5 border-white/20"
                              min={0}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-white">Descripción (opcional)</Label>
                        <Input
                          value={newTierForm.description}
                          onChange={(e) => setNewTierForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Información adicional sobre este tipo de boleto"
                          className="bg-white/5 border-white/20"
                        />
                      </div>

                      {/* Preview */}
                      {(parseFloat(newTierForm.price) > 0 || parseFloat(newTierForm.fee) > 0) && (
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">Total por boleto:</span>
                            <span className="text-lg font-bold text-emerald-400">
                              ${((parseFloat(newTierForm.price) || 0) + (parseFloat(newTierForm.fee) || 0)).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setNewTierForm({ open: false, label: "", price: "", fee: "", capacity: "", description: "" })}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!newTierForm.label.trim()) {
                              toastUI({
                                title: "Error",
                                description: "El nombre del tipo de boleto es requerido",
                                variant: "destructive",
                              });
                              return;
                            }

                            const price = parseFloat(newTierForm.price) || 0;
                            const fee = parseFloat(newTierForm.fee) || 0;
                            const capacity = newTierForm.capacity ? parseInt(newTierForm.capacity, 10) : null;
                            if (capacity !== null && capacity < 0) {
                              toastUI({
                                title: "Error",
                                description: "La capacidad no puede ser negativa",
                                variant: "destructive",
                              });
                              return;
                            }

                            try {
                              const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/tiers`, {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                },
                                body: JSON.stringify({
                                  label: newTierForm.label,
                                  price,
                                  fee,
                                  description: newTierForm.description || null,
                                  currency: "MXN",
                                  capacity,
                                  isDefault: tiers.length === 0,
                                }),
                              });

                              if (!response.ok) throw new Error("Error al crear tipo de boleto");
                              
                              const newTier = await response.json();
                              setTiers(prev => [...prev, {
                                id: newTier.id,
                                label: newTierForm.label,
                                description: newTierForm.description || null,
                                price,
                                fee,
                                currency: "MXN",
                                zoneId: null,
                                sectionId: null,
                                sectionName: null,
                                sessionId: null,
                                isDefault: tiers.length === 0,
                                capacity,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                              }]);
                              setNewTierForm({ open: false, label: "", price: "", fee: "", capacity: "", description: "" });
                              toastUI({ title: "Tipo de boleto creado exitosamente" });
                            } catch {
                              toastUI({
                                title: "Error",
                                description: "No se pudo crear el tipo de boleto",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="flex-1"
                          disabled={!newTierForm.label.trim()}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Crear tipo
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* EVENTOS CON MAPA - Section-based pricing (seated + hybrid) */}
          {(eventType === "seated" || eventType === "hybrid") && layoutSections.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Asigna un precio a cada sección del mapa. Los asientos de cada sección usarán el precio correspondiente.
              </p>
              
              <div className="grid gap-3">
                {layoutSections.map((section) => {
                  // Buscar por sectionId primero, luego por label como fallback para tiers antiguos
                  const sectionTier = tiers.find(t => t.sectionId === section.id) 
                    || tiers.find(t => !t.sectionId && t.label.trim().toLowerCase() === section.name.trim().toLowerCase());
                  const isGA = section.admissionType === "general";
                  return (
                    <Card key={section.id} className="border-white/10 bg-white/5">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Section color indicator */}
                          <div 
                            className="w-4 h-4 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: section.color || '#3B82F6' }}
                          />
                          
                          {/* Section name */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white truncate">{section.name}</p>
                              {isGA && (
                                <Badge variant="secondary" className="bg-purple-600/20 text-purple-300 border-purple-500/30 text-[10px]">
                                  General
                                </Badge>
                              )}
                            </div>
                            {isGA ? (
                              <p className="text-xs text-slate-400">{section.capacity || 0} capacidad</p>
                            ) : (
                              section.seatCount !== undefined && (
                                <p className="text-xs text-slate-400">{section.seatCount} asientos</p>
                              )
                            )}
                          </div>
                          
                          {/* Price inputs */}
                          <div className="flex items-center gap-2">
                            {/* Base price */}
                            <div>
                              <Label className="text-[10px] text-slate-500">Precio base</Label>
                              <div className="relative w-28">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <Input
                                  type="number"
                                  value={sectionTier?.price || ""}
                                  onChange={(e) => {
                                    const newPrice = parseFloat(e.target.value) || 0;
                                    handleSectionPriceChange(section, newPrice, sectionTier?.fee || 0);
                                  }}
                                  className="pl-7 h-9 bg-white/5 border-white/20"
                                  placeholder="0"
                                  min={0}
                                />
                              </div>
                            </div>
                            
                            {/* Fee */}
                            <div>
                              <Label className="text-[10px] text-slate-500">+ Fee</Label>
                              <div className="relative w-24">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <Input
                                  type="number"
                                  value={sectionTier?.fee || "0"}
                                  onChange={(e) => {
                                    const newFee = parseFloat(e.target.value) || 0;
                                    handleSectionPriceChange(section, sectionTier?.price || 0, newFee);
                                  }}
                                  className="pl-7 h-9 bg-white/5 border-white/20"
                                  placeholder="0"
                                  min={0}
                                />
                              </div>
                            </div>
                            
                            {/* Total display */}
                            {sectionTier && (sectionTier.price > 0 || (sectionTier.fee && sectionTier.fee > 0)) && (
                              <div className="text-right">
                                <Label className="text-[10px] text-slate-500">Total</Label>
                                <p className="text-sm font-bold text-emerald-400">
                                  ${(sectionTier.price + (sectionTier.fee || 0)).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {/* Status indicator */}
                          {sectionTier && sectionTier.price > 0 ? (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-0">
                              Listo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                              Sin precio
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              
              {/* Summary */}
              <Card className="border-cyan-500/30 bg-cyan-500/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Resumen de precios</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {tiers.filter(t => t.sectionId && t.price > 0).length} de {layoutSections.length} secciones con precio
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Rango de precios</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {tiers.filter(t => t.sectionId && t.price > 0).length > 0 
                          ? `$${Math.min(...tiers.filter(t => t.sectionId && t.price > 0).map(t => t.price)).toLocaleString()} - $${Math.max(...tiers.filter(t => t.sectionId && t.price > 0).map(t => t.price)).toLocaleString()}`
                          : '$0'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Empty state for seated/hybrid events without sections */}
          {(eventType === "seated" || eventType === "hybrid") && layoutSections.length === 0 && (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-8 text-center">
                <Layers className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">
                  {layoutId 
                    ? "Este layout no tiene secciones definidas" 
                    : "Selecciona un layout en la pestaña General para configurar precios por sección"
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">Imagen miniatura</CardTitle>
                <CardDescription>Aparece en listados y tarjetas (recomendado: 400x400px)</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  id="thumbnail-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload("thumbnail", file);
                    e.target.value = ''; // Reset para permitir subir el mismo archivo
                  }}
                />
                {event.thumbnailImage ? (
                  <div className="relative group">
                    <img
                      src={event.thumbnailImage.startsWith('http') ? event.thumbnailImage : `${API_BASE_URL}${event.thumbnailImage}`}
                      alt="Thumbnail"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => document.getElementById('thumbnail-upload')?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Cambiar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-white/40 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('thumbnail-upload')?.click()}
                  >
                    <Image className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">Click para subir imagen</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">Imagen de portada</CardTitle>
                <CardDescription>Aparece en la página de detalle (recomendado: 1920x1080px, 16:9)</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload("cover", file);
                    e.target.value = ''; // Reset para permitir subir el mismo archivo
                  }}
                />
                {event.coverImage ? (
                  <div className="relative group">
                    <img
                      src={event.coverImage.startsWith('http') ? event.coverImage : `${API_BASE_URL}${event.coverImage}`}
                      alt="Cover"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => document.getElementById('cover-upload')?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Cambiar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-white/40 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('cover-upload')?.click()}
                  >
                    <Image className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">Click para subir imagen</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Session Dialog */}
      <Dialog open={sessionDialog.open} onOpenChange={(open) => setSessionDialog({ open, session: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sessionDialog.session?.id?.startsWith("new-") ? "Nueva sesión" : "Editar sesión"}
            </DialogTitle>
            <DialogDescription>
              Configura los detalles de la función o presentación
            </DialogDescription>
          </DialogHeader>
          {sessionDialog.session && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Título (opcional)</Label>
                <Input
                  value={sessionDialog.session.title || ""}
                  onChange={(e) =>
                    setSessionDialog({
                      ...sessionDialog,
                      session: { ...sessionDialog.session!, title: e.target.value },
                    })
                  }
                  placeholder="Ej: Función de gala"
                />
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha y hora de inicio *</Label>
                  <Input
                    type="datetime-local"
                    value={sessionDialog.session.startsAt?.slice(0, 16) || ""}
                    onChange={(e) =>
                      setSessionDialog({
                        ...sessionDialog,
                        session: { ...sessionDialog.session!, startsAt: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha y hora de fin</Label>
                  <Input
                    type="datetime-local"
                    value={sessionDialog.session.endsAt?.slice(0, 16) || ""}
                    onChange={(e) =>
                      setSessionDialog({
                        ...sessionDialog,
                        session: { ...sessionDialog.session!, endsAt: e.target.value || null },
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={sessionDialog.session.status}
                    onValueChange={(v) =>
                      setSessionDialog({
                        ...sessionDialog,
                        session: { ...sessionDialog.session!, status: v },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHEDULED">Programada</SelectItem>
                      <SelectItem value="SALES_OPEN">Ventas abiertas</SelectItem>
                      <SelectItem value="SOLD_OUT">Agotada</SelectItem>
                      <SelectItem value="CANCELLED">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacidad</Label>
                  <Input
                    type="number"
                    value={sessionDialog.session.capacity || ""}
                    onChange={(e) =>
                      setSessionDialog({
                        ...sessionDialog,
                        session: {
                          ...sessionDialog.session!,
                          capacity: e.target.value ? parseInt(e.target.value) : null,
                        },
                      })
                    }
                    placeholder="Sin límite"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialog({ open: false, session: null })}>
              Cancelar
            </Button>
            <Button
              onClick={() => sessionDialog.session && handleSaveSession(sessionDialog.session)}
              disabled={saving || !sessionDialog.session?.startsAt}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
}
