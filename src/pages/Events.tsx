import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  MapPin,
  Ticket,
  Loader2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState, useEffect, lazy, Suspense } from "react";
import type { EventSummary } from "@/types/api";
import PublicNavbar from "@/components/PublicNavbar";
import { normalizeImageUrl } from "@/lib/utils/imageUrl";
import { API_BASE_URL } from "@/lib/api-base";

// Lazy load WebGL component
const PrismaticBurst = lazy(() => import("@/components/PrismaticBurst"));

const ITEMS_PER_PAGE = 12;

const Events = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Get current filters from URL
  const currentPage = parseInt(searchParams.get("page") || "1");
  const currentCategory = searchParams.get("category") || "";
  const currentDateRange = searchParams.get("dateRange") || "";
  const currentSortBy = searchParams.get("sortBy") || "date";

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.listCategories(true),
  });

  // Fetch featured events
  const { data: featuredEvents } = useQuery({
    queryKey: ["featured-events"],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("status", "PUBLISHED");
      params.set("featured", "true");
      params.set("limit", "4");
      const response = await fetch(`${API_BASE_URL}/api/events?${params.toString()}`);
      if (!response.ok) throw new Error("Error fetching featured events");
      const data = await response.json();
      return data.events ?? [];
    },
  });

  // Fetch events with filters
  const { data: eventsData, isLoading } = useQuery({
    queryKey: ["public-events", currentPage, currentCategory, currentDateRange, searchQuery, currentSortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", ITEMS_PER_PAGE.toString());
      params.set("offset", ((currentPage - 1) * ITEMS_PER_PAGE).toString());
      params.set("status", "PUBLISHED");
      params.set("sortBy", currentSortBy);

      if (searchQuery) params.set("search", searchQuery);
      if (currentCategory) params.set("categoryId", currentCategory);

      // Date range filter
      if (currentDateRange) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let dateFrom: Date | null = null;
        let dateTo: Date | null = null;

        switch (currentDateRange) {
          case "today":
            dateFrom = today;
            dateTo = new Date(today);
            dateTo.setHours(23, 59, 59, 999);
            break;
          case "weekend":
            const dayOfWeek = today.getDay();
            const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
            dateFrom = new Date(today);
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              dateFrom = today;
            } else {
              dateFrom.setDate(today.getDate() + daysUntilSaturday);
            }
            dateTo = new Date(dateFrom);
            dateTo.setDate(dateFrom.getDate() + (dayOfWeek === 6 ? 1 : dayOfWeek === 0 ? 0 : 1));
            dateTo.setHours(23, 59, 59, 999);
            break;
          case "week":
            dateFrom = today;
            dateTo = new Date(today);
            dateTo.setDate(today.getDate() + 7);
            break;
          case "month":
            dateFrom = today;
            dateTo = new Date(today);
            dateTo.setMonth(today.getMonth() + 1);
            break;
        }

        if (dateFrom) params.set("dateFrom", dateFrom.toISOString());
        if (dateTo) params.set("dateTo", dateTo.toISOString());
      }

      const response = await fetch(`${API_BASE_URL}/api/events?${params.toString()}`);
      if (!response.ok) throw new Error("Error fetching events");
      return response.json();
    },
  });

  const events = eventsData?.events ?? [];
  const pagination = eventsData?.pagination ?? { total: 0, limit: ITEMS_PER_PAGE, offset: 0 };
  const totalPages = Math.ceil(pagination.total / ITEMS_PER_PAGE);

  // Update filters
  const updateFilters = (updates: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    // Reset to page 1 when changing filters
    if (!updates.page) {
      newParams.set("page", "1");
    }
    setSearchParams(newParams);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ q: searchQuery });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSearchParams({});
  };

  const hasActiveFilters = currentCategory || currentDateRange || searchQuery;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Fecha por confirmar";
    return new Date(dateStr).toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatPrice = (price: number) => {
    if (!price) return "Gratis";
    return `$${price.toLocaleString()}`;
  };

  // Filter sidebar content
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Category filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/70">Categoría</label>
        <Select
          value={currentCategory || "__all__"}
          onValueChange={(value) => updateFilters({ category: value === "__all__" ? "" : value })}
        >
          <SelectTrigger className="border-gold-500/20 bg-gold-500/5">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las categorías</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date range filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/70">Fecha</label>
        <Select
          value={currentDateRange || "__all__"}
          onValueChange={(value) => updateFilters({ dateRange: value === "__all__" ? "" : value })}
        >
          <SelectTrigger className="border-gold-500/20 bg-gold-500/5">
            <SelectValue placeholder="Cualquier fecha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Cualquier fecha</SelectItem>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="weekend">Este fin de semana</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort by */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/70">Ordenar por</label>
        <Select
          value={currentSortBy}
          onValueChange={(value) => updateFilters({ sortBy: value })}
        >
          <SelectTrigger className="border-gold-500/20 bg-gold-500/5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Fecha (más próximos)</SelectItem>
            <SelectItem value="name">Nombre A-Z</SelectItem>
            <SelectItem value="price">Precio</SelectItem>
            <SelectItem value="created">Más recientes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          className="w-full border-gold-500/20 hover:bg-gold-500/10"
          onClick={clearFilters}
        >
          <X className="mr-2 h-4 w-4" />
          Limpiar filtros
        </Button>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen bg-[#050505]">
      {/* PrismaticBurst Background - WebGL effect */}
      <div className="fixed inset-0 z-0">
        <Suspense fallback={<div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black" />}>
          <PrismaticBurst
            colors={['#000000', '#ffc800', '#ffe566']}
            animationType="rotate3d"
            intensity={1.8}
            speed={0.8}
            className="w-full h-full opacity-80"
          />
        </Suspense>
      </div>

      {/* Navbar */}
      <PublicNavbar />

      {/* HERO SECTION - Full width image */}
      <section className="relative h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh] min-h-[350px] sm:min-h-[450px] md:min-h-[500px] lg:min-h-[600px] w-full overflow-hidden z-10">
        {/* Hero Image - flotante con animación */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/hero-banner.png"
            alt="Compra tu Boleto"
            className="h-full w-full object-contain object-center scale-[0.85] sm:scale-[0.8] lg:scale-[0.75] animate-float drop-shadow-2xl"
            style={{
              filter: 'drop-shadow(0 25px 50px rgba(255, 200, 0, 0.3))'
            }}
          />
        </div>
        
        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/30 via-transparent to-[#050505]/30 pointer-events-none" />
        
        {/* Animated gold particles effect - hidden on small screens for performance */}
        <div className="absolute inset-0 opacity-50 pointer-events-none hidden sm:block">
          <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-gold-400 rounded-full animate-ping" style={{ animationDelay: '0s', animationDuration: '3s' }} />
          <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-gold-300 rounded-full animate-ping" style={{ animationDelay: '0.5s', animationDuration: '2.5s' }} />
          <div className="absolute bottom-1/3 left-1/3 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" style={{ animationDelay: '1s', animationDuration: '2s' }} />
          <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '1.5s', animationDuration: '3.5s' }} />
          <div className="absolute top-2/3 left-1/2 w-1.5 h-1.5 bg-gold-500 rounded-full animate-ping" style={{ animationDelay: '2s', animationDuration: '4s' }} />
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 sm:gap-2 animate-bounce z-20">
          <span className="text-white/60 text-xs sm:text-sm hidden sm:block">Descubre eventos</span>
          <div className="w-5 h-8 sm:w-6 sm:h-10 border-2 border-white/30 rounded-full flex justify-center pt-1.5 sm:pt-2">
            <div className="w-1 h-2 sm:w-1.5 sm:h-3 bg-gold-400 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Search Section - Floating over hero transition */}
      <section className="relative z-10 -mt-12 sm:-mt-16">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="mx-auto max-w-3xl">
            <form onSubmit={handleSearch} className="relative">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-gold-500/30 bg-[#0a0a0a]/90 p-2 sm:p-3 backdrop-blur-xl shadow-2xl shadow-gold-500/10">
                <div className="relative flex-1">
                  <Search className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-gold-400" />
                  <Input
                    placeholder="Buscar eventos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 sm:h-14 rounded-lg sm:rounded-xl border-0 bg-white/5 pl-10 sm:pl-12 text-base sm:text-lg text-white placeholder:text-white/40 focus-visible:ring-gold-500/50"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="h-11 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-5 sm:px-8 text-black font-bold text-base sm:text-lg hover:from-yellow-400 hover:to-amber-400 transition-all hover:scale-105 hover:shadow-lg hover:shadow-gold-500/30"
                >
                  <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Buscar
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Featured Events Section */}
      {featuredEvents && featuredEvents.length > 0 && (
        <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg sm:rounded-xl bg-gradient-to-br from-yellow-400/20 to-amber-500/20 p-1.5 sm:p-2">
              <span className="text-xl sm:text-2xl">⭐</span>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Eventos Destacados</h2>
              <p className="text-sm sm:text-base text-white/60">Lo mejor que no te puedes perder</p>
            </div>
          </div>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {featuredEvents.map((event: EventSummary) => (
              <Link to={`/events/${event.slug || event.id}`} key={event.id}>
                <Card className="group h-full overflow-hidden border-gold-500/20 bg-gradient-to-br from-gold-500/10 to-amber-500/10 backdrop-blur-xl transition-all hover:border-gold-500/50 hover:shadow-lg hover:shadow-gold-500/20">
                  <div className="relative h-56 overflow-hidden">
                    {event.coverImage ? (
                      <img
                        src={normalizeImageUrl(event.coverImage) || ''}
                        alt={event.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-110"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gold-500/20 to-amber-500/20">
                        <Ticket className="h-20 w-20 text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <Badge className="absolute left-3 top-3 bg-gold-500/90 text-black border-0">
                      ⭐ Destacado
                    </Badge>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="line-clamp-2 text-lg font-bold text-white drop-shadow-lg">
                        {event.name}
                      </h3>
                      {event.category && (
                        <Badge variant="outline" className="mt-2 border-white/40 bg-black/40 text-white text-xs backdrop-blur-sm">
                          {event.category.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-white/70">
                        <Calendar className="h-4 w-4 shrink-0 text-gold-400" />
                        <span className="truncate">{formatDate(event.firstSession)}</span>
                      </div>
                      {event.venue?.name && (
                        <div className="flex items-center gap-2 text-white/70">
                          <MapPin className="h-4 w-4 shrink-0 text-gold-400" />
                          <span className="truncate">{event.venue.name}</span>
                        </div>
                      )}
                    </div>
                    <Button size="sm" className="mt-4 w-full bg-gradient-to-br from-yellow-400/90 via-amber-400/80 to-yellow-500/90 text-black font-semibold border border-yellow-300/40 shadow-[0_8px_32px_rgba(255,200,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_12px_40px_rgba(255,200,0,0.45)] backdrop-blur-xl">
                      Ver evento
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Main content */}
      <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex gap-4 sm:gap-6 lg:gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden w-56 lg:w-64 shrink-0 lg:block">
            <div className="sticky top-20 sm:top-24 rounded-lg sm:rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 sm:p-6">
              <h3 className="mb-3 sm:mb-4 flex items-center gap-2 font-semibold text-white text-sm sm:text-base">
                <Filter className="h-4 w-4 text-gold-400" />
                Filtros
              </h3>
              <FilterContent />
            </div>
          </aside>

          {/* Events Grid */}
          <div className="flex-1">
            {/* Mobile filter button + Results count */}
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4">
                <h2 className="text-base sm:text-lg md:text-xl font-semibold text-white">
                  {searchQuery ? `Resultados para "${searchQuery}"` : "Próximos eventos"}
                </h2>
                <Badge variant="secondary" className="bg-white/10 text-slate-300 text-xs sm:text-sm">
                  {pagination.total} eventos
                </Badge>
              </div>

              {/* Mobile filters button */}
              <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="border-gold-500/20 lg:hidden self-start sm:self-auto">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filtros
                    {hasActiveFilters && (
                      <Badge className="ml-2 bg-gold-500 text-black text-xs">!</Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="border-gold-500/20 bg-black/95 backdrop-blur-xl">
                  <SheetHeader>
                    <SheetTitle className="text-white">Filtros</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterContent />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Active filters pills */}
            {hasActiveFilters && (
              <div className="mb-6 flex flex-wrap gap-2">
                {searchQuery && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer bg-gold-500/20 text-gold-300 hover:bg-gold-500/30"
                    onClick={() => {
                      setSearchQuery("");
                      updateFilters({ q: "" });
                    }}
                  >
                    Búsqueda: {searchQuery}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                )}
                {currentCategory && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                    onClick={() => updateFilters({ category: "" })}
                  >
                    {categories?.find((c) => c.id === currentCategory)?.name || "Categoría"}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                )}
                {currentDateRange && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"
                    onClick={() => updateFilters({ dateRange: "" })}
                  >
                    {currentDateRange === "today"
                      ? "Hoy"
                      : currentDateRange === "weekend"
                      ? "Fin de semana"
                      : currentDateRange === "week"
                      ? "Esta semana"
                      : "Este mes"}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                )}
              </div>
            )}

            {/* Loading state */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
              </div>
            ) : events.length === 0 ? (
              /* Empty state */
              <div className="py-20 text-center">
                <Ticket className="mx-auto mb-4 h-16 w-16 text-white/20" />
                <h3 className="text-xl font-semibold text-white">No hay eventos disponibles</h3>
                <p className="mt-2 text-white/60">
                  {hasActiveFilters
                    ? "Prueba a cambiar los filtros de búsqueda"
                    : "Pronto anunciaremos nuevos eventos"}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" className="mt-4 border-gold-500/20" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Events grid */}
                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                  {events.map((event: EventSummary) => (
                    <Link to={`/events/${event.slug || event.id}`} key={event.id}>
                      <Card className="group h-full overflow-hidden border-gold-500/10 bg-gradient-to-br from-gold-500/5 to-transparent backdrop-blur-xl transition-all hover:border-gold-500/30 hover:bg-gold-500/10 hover:shadow-xl hover:shadow-gold-500/10 rounded-xl sm:rounded-2xl">
                        {/* Event Image */}
                        <div className="relative h-40 sm:h-48 overflow-hidden bg-gradient-to-br from-gold-500/10 to-amber-500/10">
                          {event.thumbnailImage || event.coverImage ? (
                            <img
                              src={normalizeImageUrl(event.thumbnailImage || event.coverImage) || ''}
                              alt={event.name}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Ticket className="h-16 w-16 text-white/20" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          {event.isFeatured && (
                            <Badge className="absolute left-3 top-3 bg-gold-500/90 text-black border-0">
                              ⭐ Destacado
                            </Badge>
                          )}
                        </div>

                        <CardContent className="p-4 sm:p-5">
                          <div className="mb-2 sm:mb-3">
                            <h3 className="line-clamp-2 text-base sm:text-lg font-bold text-white transition-colors group-hover:text-gold-400">
                              {event.name}
                            </h3>
                            {event.artistName && (
                              <p className="text-xs sm:text-sm text-gold-400 mt-1 line-clamp-1">{event.artistName}</p>
                            )}
                          </div>

                          {event.category && (
                            <Badge variant="outline" className="mb-2 sm:mb-3 border-gold-500/20 text-xs">
                              {event.category.name}
                            </Badge>
                          )}

                          {event.shortDescription && (
                            <p className="text-xs sm:text-sm text-white/50 mb-2 sm:mb-3 line-clamp-2">{event.shortDescription}</p>
                          )}

                          <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                            <div className="flex items-center gap-2 text-white/70">
                              <Calendar className="h-4 w-4 shrink-0 text-gold-400" />
                              <span className="truncate">{formatDate(event.firstSession)}</span>
                            </div>
                            {event.venue?.name && (
                              <div className="flex items-center gap-2 text-white/70">
                                <MapPin className="h-4 w-4 shrink-0 text-gold-400" />
                                <span className="truncate">{event.venue.name}</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-gold-500/10 pt-4">
                            <span className="text-xs text-white/40">
                              {event.stats.sessions}{" "}
                              {event.stats.sessions === 1 ? "función" : "funciones"}
                            </span>
                            <Button size="sm" className="bg-gradient-to-br from-yellow-400/90 via-amber-400/80 to-yellow-500/90 text-black font-semibold border border-yellow-300/40 shadow-[0_8px_32px_rgba(255,200,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_12px_40px_rgba(255,200,0,0.45)] backdrop-blur-xl">
                              Ver boletos
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-gold-500/20"
                      disabled={currentPage === 1}
                      onClick={() => updateFilters({ page: String(currentPage - 1) })}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="icon"
                            className={
                              currentPage === pageNum
                                ? "bg-gold-500 text-black hover:bg-gold-400"
                                : "border-gold-500/20"
                            }
                            onClick={() => updateFilters({ page: String(pageNum) })}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      className="border-gold-500/20"
                      disabled={currentPage === totalPages}
                      onClick={() => updateFilters({ page: String(currentPage + 1) })}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>

                    <span className="ml-4 text-sm text-white/50">
                      Página {currentPage} de {totalPages}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gold-500/10 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-white/40">
          <p>© 2025 Compra tu Boleto. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Events;
