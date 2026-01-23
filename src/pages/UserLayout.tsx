import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Ticket,
  ShoppingBag,
  Calendar,
  Heart,
  User,
  LogOut,
  Menu,
  Home,
  QrCode,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useState } from "react";

const menuItems = [
  { path: "/mi-cuenta", icon: LayoutDashboard, label: "Mi Panel" },
  { path: "/mi-cuenta/boletos", icon: Ticket, label: "Mis Boletos" },
  { path: "/mi-cuenta/ordenes", icon: ShoppingBag, label: "Mis Compras" },
  { path: "/mi-cuenta/proximos", icon: Calendar, label: "Próximos Eventos" },
  { path: "/mi-cuenta/favoritos", icon: Heart, label: "Favoritos" },
  { path: "/mi-cuenta/perfil", icon: User, label: "Mi Perfil" },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { config } = useAppConfig();
  const [logoError, setLogoError] = useState(false);

  const isActive = (path: string) => {
    if (path === "/mi-cuenta") {
      return location.pathname === "/mi-cuenta";
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="mb-6 flex items-center gap-3 rounded-3xl border border-gold-500/20 bg-gold-500/5 px-4 py-4">
        {config?.appLogo && !logoError ? (
          <img 
            src={config.appLogo} 
            alt={config.appName}
            style={{ height: `${config.appLogoSize || 56}px`, maxWidth: '200px' }}
            className="object-contain transition-all duration-200"
            onError={() => setLogoError(true)}
          />
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 text-black">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-gold-300">{config?.appName || 'Boletera'}</p>
              <h1 className="text-xl font-semibold text-white">Mi Cuenta</h1>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
            >
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

      {/* Quick Links */}
      <div className="mt-4 space-y-2 border-t border-gold-500/20 pt-4">
        <Link to="/events" onClick={onNavigate}>
          <div className="flex items-center gap-3 rounded-2xl border border-gold-500/5 px-4 py-3 text-sm text-white/60 transition-all hover:border-gold-500/20 hover:text-gold-400">
            <Calendar className="h-4 w-4" />
            Explorar Eventos
          </div>
        </Link>
        <Link to="/" onClick={onNavigate}>
          <div className="flex items-center gap-3 rounded-2xl border border-gold-500/5 px-4 py-3 text-sm text-white/60 transition-all hover:border-gold-500/20 hover:text-gold-400">
            <Home className="h-4 w-4" />
            Volver al Inicio
          </div>
        </Link>
      </div>

      {/* User Info */}
      <div className="mt-6 rounded-3xl border border-gold-500/10 bg-gold-500/5 px-4 py-4">
        <p className="text-sm font-semibold text-white">{user?.name ?? "Usuario"}</p>
        <p className="text-xs text-white/60">{user?.email}</p>
        {user?.role === "ADMIN" && (
          <Link to="/admin" onClick={onNavigate}>
            <p className="mt-1 text-xs text-gold-400 hover:text-gold-300">
              → Ir al Panel Admin
            </p>
          </Link>
        )}
        <Button
          variant="outline"
          className="mt-4 w-full justify-start border-gold-500/20 text-rose-400 hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-300"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}

export default function UserLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#050505] text-white">
      {/* Background Effects - Gold theme */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,200,0,0.08),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-2/5 translate-x-20 bg-gradient-to-b from-amber-500/10 via-transparent to-yellow-500/10 blur-[140px]" />

      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 sm:h-16 items-center justify-between border-b border-gold-500/10 bg-black/80 px-3 sm:px-4 backdrop-blur-xl lg:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 text-white hover:bg-gold-500/10">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] sm:w-72 border-gold-500/20 bg-black/95 backdrop-blur-xl p-3 sm:p-4">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500">
            <Ticket className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-black" />
          </div>
          <span className="text-sm sm:text-base font-semibold">Mi Cuenta</span>
        </div>

        <Link to="/mi-cuenta/boletos">
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 text-white hover:bg-gold-500/10">
            <QrCode className="h-5 w-5" />
          </Button>
        </Link>
      </header>

      {/* Desktop Sidebar */}
      <aside className="relative z-10 hidden w-72 flex-col border-r border-gold-500/10 bg-black/50 px-4 py-6 backdrop-blur-2xl lg:flex">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-auto pt-14 sm:pt-16 lg:pt-0">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-4 sm:py-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
