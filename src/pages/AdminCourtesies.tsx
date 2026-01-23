import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Gift, Search, Calendar, MapPin, User, Mail, Phone, Ticket,
  Download, Printer, Eye, Trash2, Plus, X, Check, Loader2,
  ChevronDown, ChevronRight, FileText, Users, BarChart3, QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAppConfig } from "@/hooks/useAppConfig";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Types
interface CourtesyOrder {
  id: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  total: number;
  status: string;
  notes: string | null;
  ticketCount: number;
  eventId: string;
  eventName: string;
  eventImage: string | null;
  sessionId: string;
  sessionDate: string;
  venueName: string;
  issuedBy: { name: string; email: string } | null;
  createdAt: string;
}

interface CourtesyTicket {
  id: string;
  code: string;
  status: string;
  price: number;
  holderName: string;
  holderEmail: string;
  seatId: string | null;
  seatLabel: string | null;
  rowLabel: string | null;
  zoneName: string | null;
  zoneColor: string | null;
  tierLabel: string | null;
  event: {
    id: string;
    name: string;
    coverImage: string | null;
    description: string | null;
  };
  session: {
    id: string;
    startsAt: string;
  };
  venue: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
  };
}

interface CourtesyDetail {
  id: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  total: number;
  status: string;
  notes: string | null;
  issuedBy: { name: string; email: string } | null;
  createdAt: string;
  tickets: CourtesyTicket[];
}

interface CourtesyStats {
  totalOrders: number;
  totalTickets: number;
  usedTickets: number;
  unusedTickets: number;
  byEvent: { eventId: string; eventName: string; orderCount: number; ticketCount: number }[];
}

interface Event {
  id: string;
  name: string;
  coverImage: string | null;
}

interface EventSession {
  id: string;
  eventId: string;
  startsAt: string;
  endsAt: string | null;
}

interface PriceTier {
  id: string;
  label: string;
  price: number;
  capacity: number;
  sold: number;
}

// API calls
const fetchCourtesies = async (eventId?: string, page = 1): Promise<{ courtesies: CourtesyOrder[]; pagination: any }> => {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (eventId) params.set("eventId", eventId);
  
  const res = await fetch(`${API_BASE_URL}/api/admin/courtesies?${params}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
  });
  if (!res.ok) throw new Error("Error al cargar cortesías");
  const data = await res.json();
  console.log("Courtesies API response:", data);
  return data;
};

const fetchCourtesyDetail = async (orderId: string): Promise<{ courtesy: CourtesyDetail }> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/courtesies/${orderId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
  });
  if (!res.ok) throw new Error("Error al cargar detalle");
  return res.json();
};

const fetchCourtesyStats = async (): Promise<{ stats: CourtesyStats }> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/courtesies/stats`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
  });
  if (!res.ok) throw new Error("Error al cargar estadísticas");
  return res.json();
};

const fetchEvents = async (): Promise<Event[]> => {
  const res = await fetch(`${API_BASE_URL}/api/events?limit=100`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
  });
  if (!res.ok) throw new Error("Error al cargar eventos");
  const data = await res.json();
  return data.events || [];
};

const fetchEventSessions = async (eventId: string): Promise<EventSession[]> => {
  const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/sessions`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
  });
  if (!res.ok) throw new Error("Error al cargar sesiones");
  const data = await res.json();
  return data.sessions || [];
};

const fetchPriceTiers = async (eventId: string): Promise<PriceTier[]> => {
  const res = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
  });
  if (!res.ok) throw new Error("Error al cargar tiers");
  const data = await res.json();
  return data.priceTiers || [];
};

const createCourtesy = async (data: {
  sessionId: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone?: string;
  notes?: string;
  seatIds?: string[];
  tierId?: string;
  quantity?: number;
}) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/courtesies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al crear cortesía");
  }
  return res.json();
};

const cancelCourtesy = async (orderId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/courtesies/${orderId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al cancelar");
  }
  return res.json();
};

const fetchTicketsPdfData = async (orderId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/courtesies/${orderId}/tickets-pdf`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
  });
  if (!res.ok) throw new Error("Error al cargar datos PDF");
  return res.json();
};

// PDF Ticket Component for printing
function TicketPDF({ 
  ticket, 
  branding,
  onReady 
}: { 
  ticket: CourtesyTicket; 
  branding: { appName: string; appLogo: string | null; primaryColor: string };
  onReady?: () => void;
}) {
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  const sessionDate = ticket.session.startsAt 
    ? format(new Date(ticket.session.startsAt), "EEEE d 'de' MMMM, yyyy", { locale: es })
    : "Fecha por confirmar";
  
  const sessionTime = ticket.session.startsAt
    ? format(new Date(ticket.session.startsAt), "HH:mm 'hrs'", { locale: es })
    : "";

  return (
    <div className="ticket-page w-[210mm] min-h-[297mm] bg-white p-8 flex flex-col" style={{ pageBreakAfter: "always" }}>
      {/* Header with branding */}
      <div className="flex items-center justify-between border-b-2 pb-4 mb-6" style={{ borderColor: branding.primaryColor }}>
        <div className="flex items-center gap-3">
          {branding.appLogo ? (
            <img src={branding.appLogo} alt={branding.appName} className="h-12 object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: branding.primaryColor }}>
                <Ticket className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-800">{branding.appName}</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <Badge className="text-white text-sm px-3 py-1" style={{ backgroundColor: branding.primaryColor }}>
            CORTESÍA
          </Badge>
        </div>
      </div>

      {/* Event image and info */}
      <div className="flex gap-6 mb-6">
        {ticket.event.coverImage && (
          <div className="w-48 h-32 rounded-xl overflow-hidden flex-shrink-0">
            <img 
              src={ticket.event.coverImage} 
              alt={ticket.event.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{ticket.event.name}</h1>
          <div className="space-y-1 text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="capitalize">{sessionDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4" />
              <span className="font-semibold text-lg" style={{ color: branding.primaryColor }}>{sessionTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{ticket.venue.name}</span>
            </div>
            {ticket.venue.address && (
              <div className="flex items-center gap-2">
                <span className="w-4" />
                <span className="text-sm">{ticket.venue.address}, {ticket.venue.city}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket details */}
      <div className="bg-gray-50 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Titular</h3>
            <p className="text-lg font-semibold text-gray-900">{ticket.holderName}</p>
            {ticket.holderEmail && (
              <p className="text-sm text-gray-600">{ticket.holderEmail}</p>
            )}
          </div>
          
          {ticket.seatLabel && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Asiento</h3>
              <p className="text-lg font-semibold text-gray-900">
                {ticket.rowLabel ? `Fila ${ticket.rowLabel} - ` : ""}{ticket.seatLabel}
              </p>
              {ticket.zoneName && (
                <p className="text-sm" style={{ color: ticket.zoneColor || branding.primaryColor }}>
                  {ticket.zoneName}
                </p>
              )}
            </div>
          )}
          
          {ticket.tierLabel && !ticket.seatLabel && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Tipo</h3>
              <p className="text-lg font-semibold text-gray-900">{ticket.tierLabel}</p>
            </div>
          )}
        </div>
      </div>

      {/* QR Code section */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div ref={qrRef} className="inline-block p-4 bg-white border-2 rounded-xl" style={{ borderColor: branding.primaryColor }}>
            {/* QR Code using external API for simplicity */}
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(ticket.code)}&ecc=H`}
              alt={`QR Code: ${ticket.code}`}
              width={180}
              height={180}
              className="block"
            />
          </div>
          <p className="mt-4 text-2xl font-mono font-bold tracking-widest text-gray-800">
            {ticket.code}
          </p>
          <p className="text-sm text-gray-500 mt-1">Presenta este código en la entrada</p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t pt-4 mt-6 text-center text-xs text-gray-400">
        <p>Este boleto es personal e intransferible • {branding.appName}</p>
        <p className="mt-1">Emitido el {format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
      </div>
    </div>
  );
}

// Create Courtesy Dialog
function CreateCourtesyDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [notes, setNotes] = useState("");

  const { data: events = [] } = useQuery({
    queryKey: ["events-for-courtesy"],
    queryFn: fetchEvents,
    enabled: open,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", selectedEvent],
    queryFn: () => fetchEventSessions(selectedEvent),
    enabled: !!selectedEvent,
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ["tiers", selectedEvent],
    queryFn: () => fetchPriceTiers(selectedEvent),
    enabled: !!selectedEvent,
  });

  const createMutation = useMutation({
    mutationFn: createCourtesy,
    onSuccess: (data) => {
      toast.success(`Cortesía creada: ${data.courtesy.ticketCount} boleto(s)`);
      setOpen(false);
      resetForm();
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setStep(1);
    setSelectedEvent("");
    setSelectedSession("");
    setSelectedTier("");
    setQuantity(1);
    setRecipientName("");
    setRecipientEmail("");
    setRecipientPhone("");
    setNotes("");
  };

  const handleCreate = () => {
    if (!selectedSession || !recipientName || !recipientEmail) {
      toast.error("Completa todos los campos requeridos");
      return;
    }

    createMutation.mutate({
      sessionId: selectedSession,
      recipientName,
      recipientEmail,
      recipientPhone: recipientPhone || undefined,
      notes: notes || undefined,
      tierId: selectedTier || undefined,
      quantity: quantity,
    });
  };

  const selectedEventData = events.find(e => e.id === selectedEvent);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-br from-yellow-400/90 via-amber-400/80 to-yellow-500/90 text-black border border-yellow-300/40 shadow-[0_8px_32px_rgba(255,200,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_12px_40px_rgba(255,200,0,0.45)] backdrop-blur-xl">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Cortesía
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-400" />
            Emitir Boletos de Cortesía
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? "Selecciona el evento y sesión" : "Datos del beneficiario"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Evento *</Label>
              <Select value={selectedEvent} onValueChange={(v) => { setSelectedEvent(v); setSelectedSession(""); setSelectedTier(""); }}>
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue placeholder="Selecciona un evento" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEvent && sessions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-slate-300">Sesión *</Label>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue placeholder="Selecciona una sesión" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {format(new Date(session.startsAt), "EEEE d MMM, HH:mm", { locale: es })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedEvent && tiers.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-300">Tipo de Boleto *</Label>
                  <Select value={selectedTier} onValueChange={setSelectedTier}>
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiers.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id}>
                          {tier.label} (Disponible: {tier.capacity - tier.sold})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Cantidad</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                    className="bg-slate-800 border-slate-600"
                  />
                </div>
              </>
            )}

            {selectedEventData?.coverImage && (
              <div className="rounded-xl overflow-hidden">
                <img src={selectedEventData.coverImage} alt="" className="w-full h-32 object-cover" />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nombre del Beneficiario *</Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nombre completo"
                className="bg-slate-800 border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Email *</Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="email@ejemplo.com"
                className="bg-slate-800 border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Teléfono</Label>
              <Input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="Opcional"
                className="bg-slate-800 border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo de la cortesía, notas internas..."
                className="bg-slate-800 border-slate-600"
                rows={3}
              />
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Gift className="w-8 h-8 text-amber-400" />
                <div>
                  <p className="font-medium text-amber-300">Resumen de Cortesía</p>
                  <p className="text-sm text-slate-400">
                    {quantity} boleto(s) • {events.find(e => e.id === selectedEvent)?.name}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Atrás
            </Button>
          )}
          {step === 1 ? (
            <Button 
              onClick={() => setStep(2)} 
              disabled={!selectedEvent || !selectedSession || !selectedTier}
              className="bg-amber-500 text-black hover:bg-amber-600"
            >
              Continuar
            </Button>
          ) : (
            <Button 
              onClick={handleCreate}
              disabled={createMutation.isPending || !recipientName || !recipientEmail}
              className="bg-amber-500 text-black hover:bg-amber-600"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Emitir Cortesía
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Courtesy Detail Dialog
function CourtesyDetailDialog({ 
  orderId, 
  onClose 
}: { 
  orderId: string; 
  onClose: () => void;
}) {
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { config } = useAppConfig();

  const { data, isLoading } = useQuery({
    queryKey: ["courtesy-detail", orderId],
    queryFn: () => fetchCourtesyDetail(orderId),
    enabled: !!orderId,
  });

  const { data: pdfData } = useQuery({
    queryKey: ["courtesy-pdf", orderId],
    queryFn: () => fetchTicketsPdfData(orderId),
    enabled: !!orderId,
  });

  const handlePrint = useCallback(() => {
    if (!pdfData) return;
    
    setIsPrinting(true);
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("No se pudo abrir ventana de impresión");
      setIsPrinting(false);
      return;
    }

    const branding = pdfData.data.branding;
    const order = pdfData.data.order;
    const tickets = pdfData.data.tickets;

    // Generate ticket HTML for each ticket
    const ticketsHTML = tickets.map((ticket: any, index: number) => {
      const sessionDate = ticket.session.startsAt 
        ? format(new Date(ticket.session.startsAt), "EEEE d 'de' MMMM, yyyy", { locale: es })
        : "Fecha por confirmar";
      
      const sessionTime = ticket.session.startsAt
        ? format(new Date(ticket.session.startsAt), "HH:mm", { locale: es })
        : "";

      return `
        <div class="ticket-page">
          <!-- Decorative top gradient bar -->
          <div class="top-bar"></div>
          
          <!-- Main ticket container -->
          <div class="ticket-container">
            <!-- Header -->
            <div class="header">
              <div class="logo-section">
                ${branding.appLogo ? `
                  <img src="${branding.appLogo}" alt="${branding.appName}" class="logo-img" />
                ` : `
                  <div class="logo-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
                      <path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>
                    </svg>
                  </div>
                  <span class="logo-text">${branding.appName}</span>
                `}
              </div>
              <div class="courtesy-badge">
                <span>✨ CORTESÍA</span>
              </div>
            </div>

            <!-- Event Hero Section -->
            <div class="event-hero">
              ${ticket.event.coverImage ? `
                <div class="event-image-container">
                  <img src="${ticket.event.coverImage}" alt="${ticket.event.name}" class="event-image" />
                  <div class="event-image-overlay"></div>
                </div>
              ` : `
                <div class="event-image-placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect width="18" height="18" x="3" y="3" rx="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                </div>
              `}
              <div class="event-info">
                <h1 class="event-name">${ticket.event.name}</h1>
                <div class="event-details">
                  <div class="detail-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                    </svg>
                    <span class="capitalize">${sessionDate}</span>
                  </div>
                  <div class="detail-item time-highlight">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span class="time-text">${sessionTime} hrs</span>
                  </div>
                  <div class="detail-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>${ticket.venue.name}</span>
                  </div>
                  ${ticket.venue.address ? `
                    <div class="detail-item venue-address">
                      <span>${ticket.venue.address}${ticket.venue.city ? `, ${ticket.venue.city}` : ''}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- Ticket Info Cards -->
            <div class="info-cards">
              <div class="info-card">
                <div class="info-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div class="info-content">
                  <span class="info-label">TITULAR</span>
                  <span class="info-value">${ticket.holderName}</span>
                </div>
              </div>
              
              ${ticket.seatLabel ? `
                <div class="info-card seat-card">
                  <div class="info-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 18v3h16v-3"/><path d="M4 14v4h16v-4"/><path d="M6 14V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6"/>
                    </svg>
                  </div>
                  <div class="info-content">
                    <span class="info-label">ASIENTO</span>
                    <span class="info-value seat-value">${ticket.rowLabel ? `Fila ${ticket.rowLabel} - ` : ''}${ticket.seatLabel}</span>
                    ${ticket.zoneName ? `<span class="zone-badge">${ticket.zoneName}</span>` : ''}
                  </div>
                </div>
              ` : ticket.tierLabel ? `
                <div class="info-card">
                  <div class="info-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
                    </svg>
                  </div>
                  <div class="info-content">
                    <span class="info-label">TIPO DE ENTRADA</span>
                    <span class="info-value">${ticket.tierLabel}</span>
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- QR Section -->
            <div class="qr-section">
              <div class="qr-wrapper">
                <div class="qr-glow"></div>
                <div class="qr-container">
                  <img 
                    src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticket.code)}&ecc=H&color=1a1a2e"
                    alt="QR Code"
                    class="qr-image"
                  />
                </div>
              </div>
              <div class="ticket-code-section">
                <span class="ticket-code">${ticket.code}</span>
                <span class="scan-hint">📱 Presenta este código en la entrada</span>
              </div>
            </div>

            <!-- Decorative divider -->
            <div class="divider">
              <div class="divider-line"></div>
              <div class="divider-circle left"></div>
              <div class="divider-circle right"></div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <div class="footer-info">
                <span>Boleto ${index + 1} de ${tickets.length}</span>
                <span>•</span>
                <span>Orden: ${order.orderNumber}</span>
              </div>
              <div class="footer-legal">
                Este boleto es personal e intransferible • Emitido el ${format(new Date(), "d/MM/yyyy HH:mm", { locale: es })}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Boletos Cortesía - ${order.orderNumber}</title>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600;700&display=swap');
          
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f5f5f5;
          }
          
          @media print {
            @page { size: A4; margin: 0; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white; }
            .ticket-page { box-shadow: none !important; }
          }
          
          .ticket-page {
            width: 210mm;
            min-height: 297mm;
            background: white;
            margin: 0 auto 20px;
            page-break-after: always;
            position: relative;
            overflow: hidden;
          }
          .ticket-page:last-child { page-break-after: auto; margin-bottom: 0; }
          
          .top-bar {
            height: 8px;
            background: linear-gradient(90deg, ${branding.primaryColor}, #9333ea, ${branding.primaryColor});
          }
          
          .ticket-container {
            padding: 32px 40px;
          }
          
          /* Header */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 28px;
          }
          
          .logo-section {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          
          .logo-img {
            max-height: 70px;
            max-width: 280px;
            object-fit: contain;
          }
          
          .logo-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, ${branding.primaryColor}, #9333ea);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);
          }
          
          .logo-text {
            font-size: 22px;
            font-weight: 800;
            background: linear-gradient(135deg, #1a1a2e, ${branding.primaryColor});
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .courtesy-badge {
            background: linear-gradient(135deg, #9333ea, #c026d3);
            color: white;
            padding: 8px 20px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 13px;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4);
          }
          
          /* Event Hero */
          .event-hero {
            display: flex;
            gap: 28px;
            margin-bottom: 28px;
            padding: 24px;
            background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%);
            border-radius: 20px;
            border: 1px solid #e5e5e5;
          }
          
          .event-image-container {
            width: 180px;
            height: 140px;
            border-radius: 16px;
            overflow: hidden;
            position: relative;
            flex-shrink: 0;
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          }
          
          .event-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .event-image-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.3) 100%);
          }
          
          .event-image-placeholder {
            width: 180px;
            height: 140px;
            border-radius: 16px;
            background: linear-gradient(135deg, #e5e5e5, #d4d4d4);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
            flex-shrink: 0;
          }
          
          .event-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          
          .event-name {
            font-size: 28px;
            font-weight: 800;
            color: #1a1a2e;
            margin-bottom: 16px;
            line-height: 1.2;
          }
          
          .event-details {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .detail-item {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #666;
            font-size: 14px;
          }
          
          .detail-item svg { color: #888; flex-shrink: 0; }
          
          .detail-item.time-highlight {
            color: ${branding.primaryColor};
          }
          
          .detail-item.time-highlight svg { color: ${branding.primaryColor}; }
          
          .time-text {
            font-size: 20px;
            font-weight: 700;
          }
          
          .venue-address {
            padding-left: 28px;
            font-size: 13px;
            color: #888;
          }
          
          .capitalize { text-transform: capitalize; }
          
          /* Info Cards */
          .info-cards {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 28px;
          }
          
          .info-card {
            background: white;
            border: 2px solid #e5e5e5;
            border-radius: 16px;
            padding: 20px;
            display: flex;
            align-items: flex-start;
            gap: 14px;
            transition: all 0.2s;
          }
          
          .info-card.seat-card {
            background: linear-gradient(135deg, ${branding.primaryColor}08, ${branding.primaryColor}15);
            border-color: ${branding.primaryColor}40;
          }
          
          .info-icon {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #f5f5f5, #ebebeb);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            flex-shrink: 0;
          }
          
          .seat-card .info-icon {
            background: linear-gradient(135deg, ${branding.primaryColor}, #9333ea);
            color: white;
          }
          
          .info-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          
          .info-label {
            font-size: 11px;
            font-weight: 600;
            color: #888;
            letter-spacing: 0.8px;
          }
          
          .info-value {
            font-size: 17px;
            font-weight: 700;
            color: #1a1a2e;
          }
          
          .seat-value {
            font-size: 20px;
            color: ${branding.primaryColor};
          }
          
          .zone-badge {
            display: inline-block;
            background: ${branding.primaryColor}20;
            color: ${branding.primaryColor};
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 4px;
          }
          
          /* QR Section */
          .qr-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 32px 0;
          }
          
          .qr-wrapper {
            position: relative;
            margin-bottom: 20px;
          }
          
          .qr-glow {
            position: absolute;
            inset: -20px;
            background: radial-gradient(circle, ${branding.primaryColor}20 0%, transparent 70%);
            border-radius: 50%;
            z-index: 0;
          }
          
          .qr-container {
            position: relative;
            z-index: 1;
            background: white;
            padding: 16px;
            border-radius: 20px;
            border: 3px solid ${branding.primaryColor};
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          }
          
          .qr-image {
            display: block;
            width: 180px;
            height: 180px;
          }
          
          .ticket-code-section {
            text-align: center;
          }
          
          .ticket-code {
            display: block;
            font-family: 'JetBrains Mono', monospace;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 6px;
            color: #1a1a2e;
            margin-bottom: 8px;
          }
          
          .scan-hint {
            font-size: 14px;
            color: #888;
          }
          
          /* Divider */
          .divider {
            position: relative;
            height: 1px;
            margin: 24px 0;
          }
          
          .divider-line {
            position: absolute;
            left: 20px;
            right: 20px;
            top: 50%;
            height: 2px;
            background: repeating-linear-gradient(90deg, #ddd 0, #ddd 8px, transparent 8px, transparent 16px);
          }
          
          .divider-circle {
            position: absolute;
            width: 24px;
            height: 24px;
            background: #f5f5f5;
            border-radius: 50%;
            top: 50%;
            transform: translateY(-50%);
          }
          
          .divider-circle.left { left: -12px; }
          .divider-circle.right { right: -12px; }
          
          /* Footer */
          .footer {
            text-align: center;
            padding-top: 16px;
          }
          
          .footer-info {
            display: flex;
            justify-content: center;
            gap: 12px;
            font-size: 13px;
            color: #666;
            margin-bottom: 8px;
          }
          
          .footer-legal {
            font-size: 11px;
            color: #aaa;
          }
        </style>
      </head>
      <body>
        ${ticketsHTML}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setIsPrinting(false);
  }, [pdfData, data]);

  const courtesy = data?.courtesy;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!courtesy) return null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          Cortesía #{courtesy.orderNumber}
        </DialogTitle>
        <DialogDescription>
          Emitida el {format(new Date(courtesy.createdAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Recipient info */}
        <div className="bg-slate-800/50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-slate-400 mb-3">Beneficiario</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              <span className="text-white">{courtesy.buyerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300">{courtesy.buyerEmail}</span>
            </div>
            {courtesy.buyerPhone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-500" />
                <span className="text-slate-300">{courtesy.buyerPhone}</span>
              </div>
            )}
          </div>
          {courtesy.notes && (
            <p className="mt-3 text-sm text-slate-400 italic">"{courtesy.notes}"</p>
          )}
        </div>

        {/* Tickets table */}
        <div>
          <h4 className="text-sm font-medium text-slate-400 mb-3">
            Boletos ({courtesy.tickets.length})
          </h4>
          <div className="border border-slate-700 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">Código</TableHead>
                  <TableHead className="text-slate-400">Asiento</TableHead>
                  <TableHead className="text-slate-400">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courtesy.tickets.map((ticket) => (
                  <TableRow key={ticket.id} className="border-slate-700">
                    <TableCell className="font-mono text-amber-400">{ticket.code}</TableCell>
                    <TableCell className="text-white">
                      {ticket.seatLabel ? (
                        <>
                          {ticket.rowLabel && `Fila ${ticket.rowLabel} - `}
                          {ticket.seatLabel}
                          {ticket.zoneName && (
                            <span className="text-xs text-slate-400 ml-2">({ticket.zoneName})</span>
                          )}
                        </>
                      ) : (
                        ticket.tierLabel || "General"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ticket.status === "SOLD" ? "default" : "destructive"}>
                        {ticket.status === "SOLD" ? "Activo" : ticket.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        <Button
          onClick={handlePrint}
          disabled={isPrinting || !pdfData}
          className="bg-amber-500 text-black hover:bg-amber-600"
        >
          {isPrinting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Printer className="w-4 h-4 mr-2" />
          )}
          Imprimir Boletos
        </Button>
      </DialogFooter>

      {/* Hidden print content */}
      {pdfData && (
        <div ref={printRef} className="hidden print:block">
          {pdfData.data.tickets.map((ticket: any) => (
            <TicketPDF
              key={ticket.id}
              ticket={ticket}
              branding={pdfData.data.branding}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Main Component
export default function AdminCourtesies() {
  const [filterEvent, setFilterEvent] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourtesy, setSelectedCourtesy] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: courtesiesData, isLoading } = useQuery({
    queryKey: ["courtesies", filterEvent],
    queryFn: () => fetchCourtesies(filterEvent || undefined),
  });

  const { data: statsData } = useQuery({
    queryKey: ["courtesies-stats"],
    queryFn: fetchCourtesyStats,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events-filter"],
    queryFn: fetchEvents,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelCourtesy,
    onSuccess: () => {
      toast.success("Cortesía cancelada");
      queryClient.invalidateQueries({ queryKey: ["courtesies"] });
      queryClient.invalidateQueries({ queryKey: ["courtesies-stats"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["courtesies"] });
    queryClient.invalidateQueries({ queryKey: ["courtesies-stats"] });
  };

  const filteredCourtesies = courtesiesData?.courtesies.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.buyerName.toLowerCase().includes(term) ||
      c.buyerEmail.toLowerCase().includes(term) ||
      c.orderNumber.toLowerCase().includes(term) ||
      c.eventName?.toLowerCase().includes(term)
    );
  }) || [];

  const stats = statsData?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Gift className="w-8 h-8 text-amber-400" />
            Cortesías
          </h1>
          <p className="text-slate-400 mt-1">Emite y gestiona boletos de cortesía</p>
        </div>
        <CreateCourtesyDialog onSuccess={handleRefresh} />
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Gift className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Cortesías</p>
                  <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Ticket className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Boletos Emitidos</p>
                  <p className="text-2xl font-bold text-white">{stats.totalTickets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Utilizados</p>
                  <p className="text-2xl font-bold text-white">{stats.usedTickets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-500/20">
                  <Users className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Sin Usar</p>
                  <p className="text-2xl font-bold text-white">{stats.unusedTickets}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, email, orden o evento..."
                className="pl-10 bg-slate-900 border-slate-600"
              />
            </div>
            <Select value={filterEvent || "all"} onValueChange={(v) => setFilterEvent(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full md:w-64 bg-slate-900 border-slate-600">
                <SelectValue placeholder="Todos los eventos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los eventos</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Courtesies list */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            </div>
          ) : filteredCourtesies.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No hay cortesías registradas</p>
              <p className="text-sm text-slate-500 mt-1">Emite tu primera cortesía con el botón de arriba</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400">Orden</TableHead>
                  <TableHead className="text-slate-400">Beneficiario</TableHead>
                  <TableHead className="text-slate-400">Evento</TableHead>
                  <TableHead className="text-slate-400">Fecha</TableHead>
                  <TableHead className="text-slate-400 text-center">Boletos</TableHead>
                  <TableHead className="text-slate-400">Estado</TableHead>
                  <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCourtesies.map((courtesy) => (
                  <TableRow key={courtesy.id} className="border-slate-700">
                    <TableCell className="font-mono text-amber-400">
                      {courtesy.orderNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-white font-medium">{courtesy.buyerName}</p>
                        <p className="text-sm text-slate-400">{courtesy.buyerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-white">{courtesy.eventName}</p>
                        {courtesy.sessionDate && (
                          <p className="text-sm text-slate-400">
                            {format(new Date(courtesy.sessionDate), "d MMM, HH:mm", { locale: es })}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {format(new Date(courtesy.createdAt), "d MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-slate-700">
                        {courtesy.ticketCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={courtesy.status === "PAID" ? "default" : "destructive"}
                        className={courtesy.status === "PAID" ? "bg-emerald-500/20 text-emerald-400" : ""}
                      >
                        {courtesy.status === "PAID" ? "Activa" : "Cancelada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          onClick={() => setSelectedCourtesy(courtesy.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {courtesy.status === "PAID" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-rose-400"
                            onClick={() => {
                              if (confirm("¿Cancelar esta cortesía? Los asientos serán liberados.")) {
                                cancelMutation.mutate(courtesy.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedCourtesy} onOpenChange={(v) => !v && setSelectedCourtesy(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          {selectedCourtesy && (
            <CourtesyDetailDialog
              orderId={selectedCourtesy}
              onClose={() => setSelectedCourtesy(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
