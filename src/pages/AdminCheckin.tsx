import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  QrCode,
  CheckCircle2,
  XCircle,
  Search,
  Camera,
  Ticket,
  Calendar,
  User,
  MapPin,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  Undo2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { QRScanner } from "@/components/QRScanner";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface Event {
  id: string;
  name: string;
}

interface Session {
  id: string;
  title: string | null;
  startsAt: string;
  eventId: string;
}

interface CheckinResult {
  success: boolean;
  message: string;
  ticket?: {
    id: string;
    code: string;
    status: string;
    checkedInAt: string | null;
    seat: string | null;
    zone: string | null;
    buyerName: string | null;
    buyerEmail: string | null;
    event: string;
    session: string;
    sessionDate: string;
  };
  error?: string;
  alreadyUsed?: boolean;
  usedAt?: string;
}

interface SessionStats {
  total: number;
  checkedIn: number;
  pending: number;
  percentage: number;
}

interface RecentCheckin {
  code: string;
  time: string;
  seat: string | null;
  zone: string | null;
  success: boolean;
}

const AdminCheckin = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [ticketCode, setTicketCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<RecentCheckin[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null);
  const [isScannerMode, setIsScannerMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch events on mount
  useEffect(() => {
    fetchEvents();
  }, []);

  // Fetch sessions when event changes
  useEffect(() => {
    if (selectedEvent) {
      fetchSessions(selectedEvent);
    } else {
      setSessions([]);
      setSelectedSession("");
    }
  }, [selectedEvent]);

  // Fetch stats when session changes
  useEffect(() => {
    if (selectedSession) {
      fetchSessionStats(selectedSession);
      // Auto-refresh stats every 30 seconds
      const interval = setInterval(() => fetchSessionStats(selectedSession), 30000);
      return () => clearInterval(interval);
    }
  }, [selectedSession]);

  // Focus input when ready
  useEffect(() => {
    if (selectedSession && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedSession, showResult]);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events?status=PUBLISHED`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    }
  };

  const fetchSessions = async (eventId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/sessions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }
  };

  const fetchSessionStats = async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/checkin/session/${sessionId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessionStats(data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const handleCheckin = useCallback(async () => {
    if (!ticketCode.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/checkin/${ticketCode.trim()}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: selectedSession || undefined }),
      });
      
      const data: CheckinResult = await res.json();
      setLastResult(data);
      setShowResult(true);
      
      // Add to recent checkins
      setRecentCheckins(prev => [
        {
          code: ticketCode.trim(),
          time: new Date().toISOString(),
          seat: data.ticket?.seat || null,
          zone: data.ticket?.zone || null,
          success: data.success,
        },
        ...prev.slice(0, 9),
      ]);
      
      // Refresh stats
      if (selectedSession) {
        fetchSessionStats(selectedSession);
      }
      
      // Play sound feedback
      if (data.success) {
        toast.success("Check-in exitoso", { description: data.message });
      } else {
        toast.error("Check-in fallido", { description: data.message });
      }
      
      // Clear input after short delay
      setTimeout(() => {
        setTicketCode("");
        inputRef.current?.focus();
      }, 100);
    } catch (err) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [ticketCode, selectedSession, token]);

  const handleUndoCheckin = async () => {
    if (!lastResult?.ticket?.code) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/checkin/${lastResult.ticket.code}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        toast.success("Check-in revertido");
        setShowResult(false);
        setLastResult(null);
        if (selectedSession) {
          fetchSessionStats(selectedSession);
        }
      } else {
        toast.error("No se pudo revertir el check-in");
      }
    } catch (err) {
      toast.error("Error al revertir");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && ticketCode.trim()) {
      handleCheckin();
    }
  };

  const selectedSessionData = sessions.find(s => s.id === selectedSession);

  return (
    <div className="space-y-6 px-2 py-4 text-white lg:px-0">
      {/* Header */}
      <div className="rounded-[32px] border border-white/10 bg-gradient-to-r from-emerald-500/10 via-transparent to-cyan-500/20 px-8 py-8 backdrop-blur-2xl">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-300">Control de acceso</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-white">Check-in de Boletos</h1>
            <p className="text-slate-300">Escanea o ingresa códigos de boletos</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={isScannerMode ? "default" : "outline"}
              onClick={() => setIsScannerMode(!isScannerMode)}
              className={isScannerMode ? "bg-cyan-500" : "border-white/10"}
            >
              <Camera className="h-4 w-4 mr-2" />
              {isScannerMode ? "Modo Scanner Activo" : "Activar Scanner"}
            </Button>
          </div>
        </div>
      </div>

      {/* Event/Session Selection */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Evento</Label>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="border-white/20 bg-white/5">
              <SelectValue placeholder="Selecciona un evento" />
            </SelectTrigger>
            <SelectContent>
              {events.map(event => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sesión</Label>
          <Select value={selectedSession} onValueChange={setSelectedSession} disabled={!selectedEvent}>
            <SelectTrigger className="border-white/20 bg-white/5">
              <SelectValue placeholder="Selecciona una sesión" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map(session => (
                <SelectItem key={session.id} value={session.id}>
                  {session.title || "Función"} - {format(new Date(session.startsAt), "dd/MM/yyyy HH:mm")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Check-in Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Code Input */}
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-cyan-400" />
                Ingresar Código
              </CardTitle>
              <CardDescription>
                Escanea el código QR o ingresa el código manualmente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    ref={inputRef}
                    value={ticketCode}
                    onChange={e => setTicketCode(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    placeholder="BOLT-XXXXXX"
                    className="pl-10 h-14 text-xl font-mono tracking-wider border-white/20 bg-white/5"
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <Button
                  onClick={handleCheckin}
                  disabled={!ticketCode.trim() || loading}
                  className="h-14 px-8 bg-emerald-500 hover:bg-emerald-600"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Check-in
                    </>
                  )}
                </Button>
              </div>
              
              {isScannerMode && (
                <QRScanner
                  onScan={(code) => {
                    setTicketCode(code);
                    // Auto check-in al escanear
                    setTimeout(() => handleCheckin(), 100);
                  }}
                  isProcessing={loading}
                  lastResult={lastResult ? { success: lastResult.success, message: lastResult.message } : null}
                />
              )}
              
              {!isScannerMode && (
                <div className="mt-4 p-4 bg-slate-500/10 rounded-lg border border-slate-500/20">
                  <p className="text-sm text-slate-300 flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Activa el modo scanner para usar la cámara y escanear códigos QR automáticamente
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session Stats */}
          {sessionStats && selectedSessionData && (
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-400" />
                    Estadísticas de la sesión
                  </span>
                  <Badge variant="outline" className="border-purple-500/50 text-purple-300">
                    {format(new Date(selectedSessionData.startsAt), "HH:mm", { locale: es })} hrs
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 bg-emerald-500/10 rounded-lg">
                    <p className="text-3xl font-bold text-emerald-400">{sessionStats.checkedIn}</p>
                    <p className="text-sm text-slate-400">Check-ins</p>
                  </div>
                  <div className="text-center p-4 bg-amber-500/10 rounded-lg">
                    <p className="text-3xl font-bold text-amber-400">{sessionStats.pending}</p>
                    <p className="text-sm text-slate-400">Pendientes</p>
                  </div>
                  <div className="text-center p-4 bg-cyan-500/10 rounded-lg">
                    <p className="text-3xl font-bold text-cyan-400">{sessionStats.percentage.toFixed(1)}%</p>
                    <p className="text-sm text-slate-400">Asistencia</p>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-slate-400 mb-1">
                    <span>Progreso de acceso</span>
                    <span>{sessionStats.checkedIn} / {sessionStats.total}</span>
                  </div>
                  <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                      style={{ width: `${sessionStats.percentage}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Check-ins */}
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-400" />
                Check-ins recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentCheckins.length > 0 ? (
                <div className="space-y-2">
                  {recentCheckins.map((checkin, index) => (
                    <div
                      key={`${checkin.code}-${index}`}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        checkin.success ? "bg-emerald-500/10" : "bg-red-500/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {checkin.success ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400" />
                        )}
                        <div>
                          <p className="font-mono font-medium">{checkin.code}</p>
                          <p className="text-xs text-slate-400">
                            {checkin.zone && `${checkin.zone} • `}
                            {checkin.seat || "Sin asiento"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(checkin.time), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-8">
                  No hay check-ins recientes
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side Panel - Instructions */}
        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-cyan-400" />
                Instrucciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                  1
                </div>
                <p>Selecciona el evento y la sesión correspondiente</p>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                  2
                </div>
                <p>Escanea el código QR del boleto o ingresa el código manualmente</p>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                  3
                </div>
                <p>El sistema validará automáticamente el boleto</p>
              </div>
              <Separator className="bg-white/10" />
              <div className="space-y-2">
                <p className="font-medium text-white">Estados de boleto:</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Válido - Acceso permitido</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-400" />
                  <span>Inválido - Acceso denegado</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <span>Ya usado - Verificar</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          {sessionStats && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-5xl font-bold text-emerald-400">{sessionStats.checkedIn}</p>
                  <p className="text-slate-400 mt-1">personas ingresaron</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Result Dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className={`max-w-md ${
          lastResult?.success ? "border-emerald-500/30" : "border-red-500/30"
        }`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {lastResult?.success ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                    <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                  </div>
                  <span className="text-emerald-400">Check-in Exitoso</span>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                    <XCircle className="h-7 w-7 text-red-400" />
                  </div>
                  <span className="text-red-400">Check-in Fallido</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Resultado del check-in
            </DialogDescription>
          </DialogHeader>
          
          {lastResult?.ticket && (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-white/5 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Código:</span>
                  <span className="font-mono font-bold">{lastResult.ticket.code}</span>
                </div>
                {lastResult.ticket.buyerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Titular:</span>
                    <span>{lastResult.ticket.buyerName}</span>
                  </div>
                )}
                {lastResult.ticket.zone && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Zona:</span>
                    <span>{lastResult.ticket.zone}</span>
                  </div>
                )}
                {lastResult.ticket.seat && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Asiento:</span>
                    <span>{lastResult.ticket.seat}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Evento:</span>
                  <span className="text-right max-w-[200px] truncate">{lastResult.ticket.event}</span>
                </div>
              </div>
              
              {lastResult.alreadyUsed && lastResult.usedAt && (
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <p className="text-sm text-amber-300">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    Este boleto ya fue usado el {format(new Date(lastResult.usedAt), "dd/MM/yyyy 'a las' HH:mm")}
                  </p>
                </div>
              )}
              
              <p className="text-center text-slate-400">{lastResult.message}</p>
              
              <div className="flex gap-3">
                {lastResult.success && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleUndoCheckin}
                  >
                    <Undo2 className="h-4 w-4 mr-2" />
                    Deshacer
                  </Button>
                )}
                <Button
                  className={`flex-1 ${lastResult.success ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}
                  onClick={() => {
                    setShowResult(false);
                    inputRef.current?.focus();
                  }}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCheckin;
