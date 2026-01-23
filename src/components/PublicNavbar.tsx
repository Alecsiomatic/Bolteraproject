import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useAppConfig } from "@/hooks/useAppConfig";
import {
  Ticket,
  User,
  LogOut,
  LayoutDashboard,
  CalendarDays,
  Heart,
  ShoppingBag,
  Settings,
  Menu,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface PublicNavbarProps {
  variant?: "transparent" | "solid";
  className?: string;
}

export function PublicNavbar({ variant = "solid", className = "" }: PublicNavbarProps) {
  const { user, logout } = useAuth();
  const { config } = useAppConfig();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const isTransparent = variant === "transparent";

  // Componente del logo reutilizable - usa config dinámico
  const LogoDisplay = ({ size = "normal" }: { size?: "normal" | "small" }) => {
    const baseSize = config.appLogoSize || 56;
    const logoHeight = size === "small" ? Math.round(baseSize * 0.55) : Math.round(baseSize * 0.7);
    
    // Fallback image - always use static file
    const fallbackLogo = "/Sin-titulo-190-x-65-px-1024-x-1024-px-1.png";
    
    // Build logo URL - handle relative and absolute paths
    let logoSrc = fallbackLogo;
    if (config.appLogo) {
      // If it's already a full URL, use it directly
      if (config.appLogo.startsWith('http')) {
        logoSrc = config.appLogo;
      } else if (config.appLogo.startsWith('/uploads')) {
        // If it's an uploads path, prefix with API base URL
        const apiBase = import.meta.env.VITE_API_URL ?? '';
        logoSrc = `${apiBase}${config.appLogo}`;
      } else if (config.appLogo.startsWith('/')) {
        logoSrc = config.appLogo;
      }
    }
    
    return (
      <div className="flex items-center gap-2">
        <img 
          src={logoSrc}
          alt={config.appName}
          style={{ height: `${logoHeight}px` }}
          className="object-contain max-w-[120px] sm:max-w-[180px] drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]"
          onError={(e) => {
            // On error, try the fallback
            const target = e.currentTarget;
            if (target.src !== window.location.origin + fallbackLogo) {
              target.src = fallbackLogo;
            }
          }}
        />
      </div>
    );
  };

  return (
    <header
      className={`fixed top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 z-50 transition-colors duration-300 rounded-xl sm:rounded-2xl ${
        isTransparent && !scrolled
          ? "border-transparent bg-transparent rounded-none top-0 left-0 right-0"
          : "border border-white/[0.08] bg-black/80 sm:bg-white/[0.03] sm:backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      } ${className}`}
    >
      <div className="container relative mx-auto flex h-14 sm:h-16 items-center justify-between px-2 sm:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center flex-shrink-0">
          <LogoDisplay />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-2 md:flex">
          <Link to="/events">
            <Button variant="ghost" className="text-white/70 hover:bg-gold-500/10 hover:text-gold-400">
              Eventos
            </Button>
          </Link>
          <Link to="/artistas">
            <Button variant="ghost" className="text-white/70 hover:bg-gold-500/10 hover:text-gold-400">
              Artistas
            </Button>
          </Link>
          <Link to="/playlists">
            <Button variant="ghost" className="text-white/70 hover:bg-gold-500/10 hover:text-gold-400">
              Música
            </Button>
          </Link>

          {user ? (
            <>
              {/* Logged in navigation */}
              <Link to="/mi-cuenta">
                <Button variant="ghost" className="text-white/70 hover:bg-gold-500/10 hover:text-gold-400">
                  Mi cuenta
                </Button>
              </Link>

              {user.role === "ADMIN" && (
                <Link to="/admin">
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 border-gold-500/50 text-gold-400 hover:bg-gold-500/10 hover:text-gold-300"
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Panel Admin
                  </Button>
                </Link>
              )}

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="ml-2 flex items-center gap-2 rounded-full bg-gold-500/10 px-3 hover:bg-gold-500/20"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-sm font-medium text-black">
                      {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden text-sm text-white lg:inline">
                      {user.name?.split(" ")[0] || "Mi cuenta"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 border-gold-500/20 bg-black/95 backdrop-blur-xl text-white"
                >
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-white">{user.name || "Usuario"}</p>
                    <p className="text-xs text-white/50">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-gold-500/20" />
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-gold-500/10 focus:bg-gold-500/10">
                    <Link to="/mi-cuenta" className="flex items-center">
                      <LayoutDashboard className="mr-2 h-4 w-4 text-gold-400" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-gold-500/10 focus:bg-gold-500/10">
                    <Link to="/mi-cuenta/ordenes" className="flex items-center">
                      <ShoppingBag className="mr-2 h-4 w-4 text-gold-400" />
                      Mis órdenes
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-gold-500/10 focus:bg-gold-500/10">
                    <Link to="/mi-cuenta/proximos" className="flex items-center">
                      <CalendarDays className="mr-2 h-4 w-4 text-gold-400" />
                      Próximos eventos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-gold-500/10 focus:bg-gold-500/10">
                    <Link to="/mi-cuenta/favoritos" className="flex items-center">
                      <Heart className="mr-2 h-4 w-4 text-gold-400" />
                      Favoritos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gold-500/20" />
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-gold-500/10 focus:bg-gold-500/10">
                    <Link to="/mi-cuenta/perfil" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4 text-gold-400" />
                      Configuración
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gold-500/20" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-red-400 hover:bg-red-500/10 hover:text-red-400 focus:bg-red-500/10"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              {/* Not logged in */}
              <Link to="/login">
                <Button variant="ghost" className="text-white/70 hover:bg-gold-500/10 hover:text-gold-400">
                  Iniciar sesión
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-gradient-to-br from-yellow-400/90 via-amber-400/80 to-yellow-500/90 text-black font-semibold border border-yellow-300/40 shadow-[0_8px_32px_rgba(255,200,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_12px_40px_rgba(255,200,0,0.45)] backdrop-blur-xl">
                  Registrarse
                </Button>
              </Link>
            </>
          )}
        </nav>

        {/* Mobile Menu */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="text-white hover:bg-gold-500/10">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-80 border-gold-500/20 bg-black/95 backdrop-blur-xl p-0"
          >
            <div className="flex h-full flex-col">
              {/* Mobile header */}
              <div className="flex items-center justify-between border-b border-gold-500/20 p-4">
                <Link to="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <LogoDisplay size="small" />
                </Link>
              </div>

              {/* User info (if logged in) */}
              {user && (
                <div className="border-b border-gold-500/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-lg font-medium text-black">
                      {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{user.name || "Usuario"}</p>
                      <p className="text-sm text-white/50">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation links */}
              <nav className="flex-1 space-y-1 p-4">
                <Link
                  to="/events"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/70 transition-colors hover:bg-gold-500/10 hover:text-gold-400"
                >
                  <CalendarDays className="h-5 w-5" />
                  Eventos
                </Link>
                <Link
                  to="/artistas"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/70 transition-colors hover:bg-gold-500/10 hover:text-gold-400"
                >
                  <User className="h-5 w-5" />
                  Artistas
                </Link>
                <Link
                  to="/playlists"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/70 transition-colors hover:bg-gold-500/10 hover:text-gold-400"
                >
                  <Ticket className="h-5 w-5" />
                  Música
                </Link>

                {user ? (
                  <>
                    <Link
                      to="/mi-cuenta"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/70 transition-colors hover:bg-gold-500/10 hover:text-gold-400"
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      Mi cuenta
                    </Link>
                    <Link
                      to="/mi-cuenta/ordenes"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/70 transition-colors hover:bg-gold-500/10 hover:text-gold-400"
                    >
                      <ShoppingBag className="h-5 w-5" />
                      Mis órdenes
                    </Link>
                    <Link
                      to="/mi-cuenta/proximos"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/70 transition-colors hover:bg-gold-500/10 hover:text-gold-400"
                    >
                      <CalendarDays className="h-5 w-5" />
                      Próximos eventos
                    </Link>
                    <Link
                      to="/mi-cuenta/favoritos"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/70 transition-colors hover:bg-gold-500/10 hover:text-gold-400"
                    >
                      <Heart className="h-5 w-5" />
                      Favoritos
                    </Link>
                    <Link
                      to="/mi-cuenta/perfil"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/70 transition-colors hover:bg-gold-500/10 hover:text-gold-400"
                    >
                      <Settings className="h-5 w-5" />
                      Configuración
                    </Link>

                    {user.role === "ADMIN" && (
                      <>
                        <div className="my-2 border-t border-gold-500/20" />
                        <Link
                          to="/admin"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-3 rounded-xl bg-gold-500/10 px-4 py-3 text-gold-400 transition-colors hover:bg-gold-500/20"
                        >
                          <LayoutDashboard className="h-5 w-5" />
                          Panel Admin
                        </Link>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/70 transition-colors hover:bg-gold-500/10 hover:text-gold-400"
                    >
                      <User className="h-5 w-5" />
                      Iniciar sesión
                    </Link>
                  </>
                )}
              </nav>

              {/* Bottom actions */}
              <div className="border-t border-gold-500/20 p-4">
                {user ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                  >
                    <LogOut className="h-5 w-5" />
                    Cerrar sesión
                  </Button>
                ) : (
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full bg-gradient-to-br from-yellow-400/90 via-amber-400/80 to-yellow-500/90 text-black font-semibold border border-yellow-300/40 shadow-[0_8px_32px_rgba(255,200,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_12px_40px_rgba(255,200,0,0.45)] backdrop-blur-xl">
                      Crear cuenta gratis
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

export default PublicNavbar;
