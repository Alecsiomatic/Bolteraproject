import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, MapPin, Calendar, Sparkles, Shield, Cpu, Star, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useAppConfig, getCurrentYear } from "@/hooks/useAppConfig";
import PublicNavbar from "@/components/PublicNavbar";
import GlassSurface from "@/components/GlassSurface";
import { useState, Suspense, lazy } from "react";
import type { EventSummary } from "@/types/api";
import { API_BASE_URL } from "@/lib/api-base";
import { normalizeImageUrl } from "@/lib/utils/imageUrl";

// Lazy load ModelViewer para mejor performance
const ModelViewer = lazy(() => import("@/components/ModelViewer"));

interface PublicStats {
  events: { value: number; label: string; sub: string };
  tickets: { value: string; label: string; sub: string };
  venues: { value: number; label: string; sub: string };
}

const features = [
  {
    icon: Ticket,
    title: "Venta Inteligente",
    desc: "Automatiza ventas, libera asientos y coordina equipos con reglas vivas.",
  },
  {
    icon: MapPin,
    title: "Mapas Interactivos",
    desc: "Editor visual para zonas complejas, patrones y asientos VIP.",
  },
  {
    icon: Shield,
    title: "Accesos Seguros",
    desc: "Roles granulares, registros auditables y autenticación moderna.",
  },
  {
    icon: Cpu,
    title: "Analítica en Vivo",
    desc: "Dashboards con proyecciones, ocupación y revenue al momento.",
  },
];

const Landing = () => {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const [modelError, setModelError] = useState(false);
  
  // Fetch public stats
  const { data: statsData } = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/public/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      return data.stats as PublicStats;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const { data: landingEvents = [], isLoading: landingEventsLoading } = useQuery({
    queryKey: ["landing-events"],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("status", "PUBLISHED");
      params.set("limit", "4");
      const res = await fetch(`${API_BASE_URL}/api/events?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      return (data.events ?? []) as EventSummary[];
    },
    staleTime: 60000,
  });
  
  const stats = statsData 
    ? [
        { label: statsData.events.label, value: String(statsData.events.value), sub: statsData.events.sub },
        { label: statsData.tickets.label, value: statsData.tickets.value, sub: statsData.tickets.sub },
        { label: statsData.venues.label, value: String(statsData.venues.value), sub: statsData.venues.sub },
      ]
    : [
        { label: "Eventos activos", value: "0", sub: "Cargando..." },
        { label: "Boletos emitidos", value: "0", sub: "Cargando..." },
        { label: "Venues conectados", value: "0", sub: "Cargando..." },
      ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-yellow-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-amber-500/8 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Navbar */}
        <PublicNavbar variant="transparent" />

        <main className="container mx-auto flex flex-1 flex-col gap-16 px-6 pb-20 pt-24">
          
          {/* ============================================
              HERO SECTION CON MODELO 3D
              ============================================ */}
          <section className="grid gap-8 md:gap-12 lg:grid-cols-2 items-center min-h-[60vh] lg:min-h-[70vh]">
            
            {/* Left: Content */}
            <div className="space-y-6 md:space-y-8 text-center lg:text-left">
              {/* Logo */}
              <img 
                src="/Sin-titulo-190-x-65-px-1024-x-1024-px-1.png" 
                alt="Compra tu Boleto MX"
                className="h-14 sm:h-16 md:h-20 w-auto object-contain mx-auto lg:mx-0"
              />
              
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gold-400">
                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                La nueva era del ticketing
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                <span className="text-white">Experiencia</span>
                <br />
                <span className="bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
                  Premium
                </span>
                <br />
                <span className="text-white/80">en Boletos</span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-white/60 max-w-lg mx-auto lg:mx-0">
                Plataforma de venta de boletos con tecnología de punta. 
                Diseña venues, controla ventas y ofrece experiencias únicas.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-2 sm:pt-4 justify-center lg:justify-start">
                <Link to="/events" className="w-full sm:w-auto">
                  <button className="btn-gold text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto">
                    <Star className="inline-block mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Explorar Eventos
                  </button>
                </Link>
                <Link to="/register" className="w-full sm:w-auto">
                  <button className="btn-gold-outline text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto">
                    Crear Cuenta
                  </button>
                </Link>
              </div>

              {/* Quick Stats */}
              <div className="flex justify-center lg:justify-start gap-4 sm:gap-6 md:gap-8 pt-4 sm:pt-6">
                {stats.map((stat) => (
                  <div key={stat.label} className="text-center lg:text-left">
                    <p className="stat-value text-xl sm:text-2xl md:text-3xl">{stat.value}</p>
                    <p className="text-xs sm:text-sm text-white/50">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: 3D Model / Fallback Visual */}
            <div className="relative flex items-center justify-center order-first lg:order-last">
              {/* Glow behind element */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[250px] sm:w-[300px] md:w-[400px] h-[250px] sm:h-[300px] md:h-[400px] rounded-full bg-gradient-radial from-yellow-500/20 via-amber-500/10 to-transparent blur-2xl animate-gold-pulse" />
              </div>
              
              <GlassSurface
                width="100%"
                height={350}
                borderRadius={24}
                className="glass-hero sm:!h-[400px] md:!h-[450px] lg:!h-[500px]"
                brightness={40}
                opacity={0.8}
              >
                {!modelError ? (
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-[480px]">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-gold-400 animate-pulse">Cargando modelo 3D...</span>
                      </div>
                    </div>
                  }>
                    <ModelViewer
                      url="/.glb"
                      width="100%"
                      height={480}
                      autoRotate
                      autoRotateSpeed={1.0}
                      fadeIn
                      enableMouseParallax={false}
                      enableHoverRotation={false}
                      enableManualRotation={true}
                      enableManualZoom={false}
                      environmentPreset="studio"
                      ambientIntensity={3.0}
                      keyLightIntensity={4.0}
                      fillLightIntensity={3.0}
                      rimLightIntensity={2.0}
                      defaultRotationX={0}
                      defaultRotationY={0}
                      defaultZoom={3.5}
                      minZoomDistance={3.0}
                      maxZoomDistance={4.0}
                      modelXOffset={0}
                      modelYOffset={0}
                      autoFrame={true}
                      showScreenshotButton={false}
                      onModelError={() => setModelError(true)}
                    />
                  </Suspense>
                ) : (
                  /* Fallback: Animated Tickets if 3D fails */
                  <div className="relative h-[480px] flex items-center justify-center overflow-hidden">
                    <div className="relative w-full h-full flex items-center justify-center">
                      {/* Central Ticket */}
                      <div className="absolute w-72 h-40 bg-gradient-to-br from-gold-400 via-amber-500 to-yellow-600 rounded-2xl shadow-2xl shadow-gold-500/30 transform rotate-[-5deg] animate-float">
                        <div className="absolute inset-0 flex items-center p-4">
                          <div className="w-16 h-16 rounded-xl bg-black/20 flex items-center justify-center mr-4">
                            <Ticket className="w-8 h-8 text-white" />
                          </div>
                          <div className="text-left">
                            <div className="text-black/80 text-xs font-medium uppercase tracking-wider">Evento Premium</div>
                            <div className="text-black font-bold text-lg">Boleto VIP</div>
                            <div className="text-black/60 text-sm">Fila A · Asiento 1</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Background Ticket 1 */}
                      <div className="absolute w-64 h-36 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 rounded-xl shadow-xl transform rotate-[15deg] translate-x-20 -translate-y-16 opacity-60">
                        <div className="absolute inset-0 flex items-center p-3">
                          <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mr-3">
                            <Sparkles className="w-6 h-6 text-gold-400" />
                          </div>
                          <div>
                            <div className="text-white/50 text-xs">General</div>
                            <div className="text-white font-semibold">Concierto</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Floating Icons */}
                      <div className="absolute top-8 left-8 w-12 h-12 rounded-full bg-gold-500/20 flex items-center justify-center animate-bounce-slow">
                        <Star className="w-6 h-6 text-gold-400" />
                      </div>
                      <div className="absolute bottom-12 right-12 w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center animate-bounce-slow" style={{ animationDelay: '0.5s' }}>
                        <Zap className="w-5 h-5 text-gold-400" />
                      </div>
                    </div>
                  </div>
                )}
              </GlassSurface>
            </div>
          </section>

          {/* ============================================
              FEATURES SECTION
              ============================================ */}
          <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <GlassSurface 
                key={feature.title}
                width="100%"
                height="auto"
                borderRadius={20}
                className="glass-card"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6 text-left w-full">
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-gold-500/10 border border-gold-500/20">
                    <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-gold-400" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white">{feature.title}</h3>
                  <p className="text-xs sm:text-sm text-white/60">{feature.desc}</p>
                </div>
              </GlassSurface>
            ))}
          </section>

          {/* ============================================
              EVENTS SECTION
              ============================================ */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Eventos</p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Eventos Destacados</h2>
                <p className="text-sm text-white/60">Descubre lo mejor que no te puedes perder</p>
              </div>
              <Link to="/events" className="hidden sm:block">
                <Button className="bg-gold-500 text-black hover:bg-gold-400">Ver todos</Button>
              </Link>
            </div>

            {landingEventsLoading ? (
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Card key={`landing-event-skeleton-${idx}`} className="border-white/10 bg-white/5">
                    <div className="h-40 sm:h-48 bg-white/5" />
                    <CardContent className="p-4">
                      <div className="h-4 w-3/4 bg-white/10 rounded" />
                      <div className="mt-3 h-3 w-1/2 bg-white/10 rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : landingEvents.length > 0 ? (
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {landingEvents.map((event) => (
                  <Link to={`/events/${event.slug || event.id}`} key={event.id}>
                    <Card className="group h-full overflow-hidden border-gold-500/10 bg-gradient-to-br from-gold-500/5 to-transparent backdrop-blur-xl transition-all hover:border-gold-500/30 hover:bg-gold-500/10 hover:shadow-xl hover:shadow-gold-500/10 rounded-xl sm:rounded-2xl">
                      <div className="relative h-40 sm:h-48 overflow-hidden bg-gradient-to-br from-gold-500/10 to-amber-500/10">
                        {event.thumbnailImage || event.coverImage ? (
                          <img
                            src={normalizeImageUrl(event.thumbnailImage || event.coverImage) || ""}
                            alt={event.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Ticket className="h-14 w-14 text-white/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        {event.isFeatured && (
                          <Badge className="absolute left-3 top-3 bg-gold-500/90 text-black border-0">⭐ Destacado</Badge>
                        )}
                      </div>
                      <CardContent className="p-4 sm:p-5">
                        <h3 className="line-clamp-2 text-base sm:text-lg font-bold text-white transition-colors group-hover:text-gold-400">
                          {event.name}
                        </h3>
                        {event.category && (
                          <Badge variant="outline" className="mt-2 border-gold-500/20 text-xs">
                            {event.category.name}
                          </Badge>
                        )}
                        <div className="mt-3 space-y-1.5 text-xs sm:text-sm text-white/70">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gold-400" />
                            <span className="truncate">{event.firstSession ? new Date(event.firstSession).toLocaleString() : "Próximamente"}</span>
                          </div>
                          {event.venue?.name && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gold-400" />
                              <span className="truncate">{event.venue.name}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 py-10 text-center text-white/60">
                No hay eventos publicados por ahora.
              </div>
            )}

            <div className="sm:hidden">
              <Link to="/events" className="w-full">
                <Button className="w-full bg-gold-500 text-black hover:bg-gold-400">Ver todos los eventos</Button>
              </Link>
            </div>
          </section>

          {/* ============================================
              CTA SECTION
              ============================================ */}
          <section className="relative">
            <GlassSurface
              width="100%"
              height="auto"
              borderRadius={24}
              className="glass-hero sm:!rounded-[32px]"
              brightness={35}
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8 p-6 sm:p-10 md:p-16 w-full">
                <div className="text-center md:text-left space-y-3 sm:space-y-4 max-w-xl">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                    ¿Listo para transformar tu evento?
                  </h2>
                  <p className="text-sm sm:text-base text-white/60">
                    Únete a las productoras que ya usan nuestra plataforma para 
                    vender más boletos y ofrecer experiencias memorables.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full md:w-auto">
                  <Link to="/register" className="w-full sm:w-auto">
                    <button className="btn-gold text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 whitespace-nowrap w-full">
                      <Zap className="inline-block mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      Comenzar Gratis
                    </button>
                  </Link>
                  <Link to="/events" className="w-full sm:w-auto">
                    <button className="btn-gold-outline text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 whitespace-nowrap w-full">
                      Ver Eventos
                    </button>
                  </Link>
                </div>
              </div>
            </GlassSurface>
          </section>

          {/* ============================================
              CANVAS PREVIEW
              ============================================ */}
          <section className="grid gap-8 lg:grid-cols-2">
            <GlassSurface
              width="100%"
              height="auto"
              borderRadius={28}
              className="glass-card"
            >
              <div className="p-8 text-left space-y-6 w-full">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Herramienta</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Editor de Asientos</h3>
                  </div>
                  <Link to="/canvas">
                    <Button className="bg-gold-500 text-black hover:bg-gold-400">
                      Abrir Canvas
                    </Button>
                  </Link>
                </div>
                <div className="neon-grid relative min-h-[200px] rounded-2xl border border-white/10 bg-black/50 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-gold-500/10 via-transparent to-amber-500/10" />
                  <div className="relative z-10 flex h-full flex-col justify-between p-6 text-sm text-white/60">
                    <p>Mapas paramétricos, snaps, duplicación y exportación en un clic.</p>
                    <div className="grid grid-cols-2 gap-3 text-xs mt-4">
                      <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 px-3 py-2 text-center text-gold-400">Zonas dinámicas</div>
                      <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 px-3 py-2 text-center text-gold-400">Templates VIP</div>
                      <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 px-3 py-2 text-center text-gold-400">Export JPEG</div>
                      <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 px-3 py-2 text-center text-gold-400">Import JSON</div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassSurface>

            <GlassSurface
              width="100%"
              height="auto"
              borderRadius={28}
              className="glass-card"
            >
              <div className="p-8 text-left space-y-6 w-full">
                <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Confianza</p>
                <p className="text-2xl text-white leading-relaxed">
                  Equipos de venues, productoras y operadores usan{" "}
                  <span className="text-gold-400 font-semibold">{config.appName}</span>{" "}
                  para sincronizar su ecosistema sin hojas de cálculo.
                </p>
                <div className="flex flex-wrap gap-3 pt-4">
                  <span className="badge-gold">Reporting en tiempo real</span>
                  <span className="badge-gold">APIs abiertas</span>
                  <span className="badge-gold">Roles personalizados</span>
                  <span className="badge-gold">Soporte 24/7</span>
                </div>
              </div>
            </GlassSurface>
          </section>

        </main>

        {/* Footer */}
        <footer className="container mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-white/10">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <img 
                src="/Sin-titulo-190-x-65-px-1024-x-1024-px-1.png" 
                alt="Logo"
                className="h-6 sm:h-8 w-auto opacity-60"
              />
              <p className="text-white/40 text-xs sm:text-sm text-center sm:text-left">
                &copy; {getCurrentYear()} {config.appName}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-white/40">
              <Link to="/events" className="hover:text-gold-400 transition-colors">Eventos</Link>
              <Link to="/login" className="hover:text-gold-400 transition-colors">Ingresar</Link>
              <Link to="/register" className="hover:text-gold-400 transition-colors">Registrarse</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
