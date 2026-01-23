import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Calendar, MapPin, Users, Settings, LogOut, Ticket, Tags, QrCode, TicketPercent, CreditCard, ShoppingCart, BarChart3, Music, ListMusic, Gift, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { config } = useAppConfig();
  
  // Live preview states for logo customization
  const [previewLogoSize, setPreviewLogoSize] = useState<number | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Listen for live preview events from settings page
  useEffect(() => {
    const handleLogoSizeChange = (e: CustomEvent<{ size: number }>) => {
      setPreviewLogoSize(e.detail.size);
    };
    const handleLogoUrlChange = (e: CustomEvent<{ url: string }>) => {
      setPreviewLogoUrl(e.detail.url);
      setLogoError(false);
    };

    window.addEventListener('logoSizeChange', handleLogoSizeChange as EventListener);
    window.addEventListener('logoUrlChange', handleLogoUrlChange as EventListener);

    return () => {
      window.removeEventListener('logoSizeChange', handleLogoSizeChange as EventListener);
      window.removeEventListener('logoUrlChange', handleLogoUrlChange as EventListener);
    };
  }, []);

  // Reset preview when navigating away from settings
  useEffect(() => {
    if (!location.pathname.includes('/admin/settings')) {
      setPreviewLogoSize(null);
      setPreviewLogoUrl(null);
    }
  }, [location.pathname]);

  // Use preview values if available, otherwise use config
  const displayLogoSize = previewLogoSize ?? config.appLogoSize;
  
  // Build proper logo URL
  const fallbackLogo = "/Sin-titulo-190-x-65-px-1024-x-1024-px-1.png";
  const rawLogoUrl = previewLogoUrl ?? config.appLogo;
  let displayLogoUrl = fallbackLogo;
  
  if (rawLogoUrl) {
    if (rawLogoUrl.startsWith('http')) {
      displayLogoUrl = rawLogoUrl;
    } else if (rawLogoUrl.startsWith('/uploads')) {
      const apiBase = import.meta.env.VITE_API_URL ?? '';
      displayLogoUrl = `${apiBase}${rawLogoUrl}`;
    } else if (rawLogoUrl.startsWith('/')) {
      displayLogoUrl = rawLogoUrl;
    }
  }

  const menuItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/events', icon: Calendar, label: 'Eventos' },
    { path: '/admin/venues', icon: MapPin, label: 'Venues' },
    { path: '/admin/categories', icon: Tags, label: 'Categorías' },
    { path: '/admin/artists', icon: Music, label: 'Artistas' },
    { path: '/admin/playlists', icon: ListMusic, label: 'Playlists' },
    { path: '/admin/coupons', icon: TicketPercent, label: 'Cupones' },
    { path: '/admin/orders', icon: ShoppingCart, label: 'Órdenes' },
    { path: '/admin/tickets', icon: Ticket, label: 'Boletos' },
    { path: '/admin/courtesies', icon: Gift, label: 'Cortesías' },
    { path: '/admin/reports', icon: BarChart3, label: 'Reportes' },
    { path: '/admin/checkin', icon: QrCode, label: 'Check-in' },
    { path: '/admin/users', icon: Users, label: 'Usuarios' },
    { path: '/admin/payments', icon: CreditCard, label: 'MercadoPago' },
    { path: '/admin/settings', icon: Settings, label: 'Configuración' },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#050505] text-white">
      {/* Gold gradient backgrounds */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,200,0,0.08),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-2/5 translate-x-20 bg-gradient-to-b from-amber-500/10 via-transparent to-yellow-500/10 blur-[140px]" />

      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-gold-500/10 bg-black/95 px-4 lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <img 
            src={displayLogoUrl} 
            alt={config.appName}
            style={{ height: '32px', maxWidth: '120px' }}
            className="object-contain"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== window.location.origin + fallbackLogo) {
                target.src = fallbackLogo;
              }
            }}
          />
        </Link>
        
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-gold-500/20">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] border-l border-gold-500/10 bg-black p-0">
            <div className="flex flex-col h-full">
              {/* Menu Header */}
              <div className="flex items-center justify-between border-b border-gold-500/10 px-4 py-4">
                <span className="text-sm font-semibold text-gold-300">Menú Admin</span>
              </div>
              
              {/* Nav Items */}
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link 
                      key={item.path} 
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                          active
                            ? "bg-gold-500/20 text-gold-300"
                            : "text-white/60 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${active ? 'text-gold-400' : ''}`} />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>
              
              {/* User Info */}
              <div className="border-t border-gold-500/10 px-4 py-4">
                <p className="text-sm font-medium text-white">{user?.name ?? "Usuario"}</p>
                <p className="text-xs text-white/50">{user?.email}</p>
                <Button
                  variant="ghost"
                  className="mt-3 w-full justify-start text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 px-0"
                  onClick={() => {
                    logout();
                    navigate("/login");
                    setMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Sidebar - Desktop */}
      <aside className="relative z-10 hidden w-72 flex-col border-r border-gold-500/10 bg-black/50 px-4 py-6 backdrop-blur-2xl lg:flex">
        <Link to="/" className="mb-6 flex items-center gap-3 rounded-3xl border border-gold-500/20 bg-gold-500/5 px-4 py-4 transition hover:border-gold-500/40 hover:bg-gold-500/10">
          <img 
            src={displayLogoUrl} 
            alt={config.appName}
            style={{ height: `${displayLogoSize}px`, maxWidth: '200px' }}
            className="object-contain transition-all duration-200"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== window.location.origin + fallbackLogo) {
                target.src = fallbackLogo;
              }
            }}
          />
        </Link>

        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path}>
                <div
                  className={`flex items-center gap-3 rounded-2xl border border-gold-500/5 px-4 py-3 text-sm transition-all ${
                    active
                      ? "border-gold-500/40 bg-gradient-to-r from-yellow-400/20 to-amber-500/20 text-gold-300"
                      : "text-white/60 hover:border-gold-500/20 hover:text-gold-400"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-gold-400' : ''}`} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 rounded-3xl border border-gold-500/10 bg-gold-500/5 px-4 py-4">
          <p className="text-sm font-semibold text-white">{user?.name ?? "Usuario"}</p>
          <p className="text-xs text-white/60">{user?.email}</p>
          <p className="text-xs text-gold-400">Rol: {user?.role}</p>
          <Button
            variant="outline"
            className="mt-4 w-full justify-start border-gold-500/20 text-rose-400 hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-300"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-auto px-4 py-6 pt-20 lg:pt-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
