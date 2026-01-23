import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Ticket,
  ArrowLeft,
  Save,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastLogin: string | null;
  _count?: {
    orders: number;
  };
}

export default function Profile() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });
  
  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      navigate("/login", { state: { from: "/profile" } });
      return;
    }
    fetchProfile();
  }, [user, token]);

  const fetchProfile = async () => {
    if (!user || !token) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error("Error al cargar el perfil");
      }
      
      const data = await response.json();
      const profileData = data.user || data;
      setProfile(profileData);
      setFormData({
        name: profileData.name || "",
        phone: profileData.phone || "",
      });
    } catch (err) {
      toast.error("Error al cargar el perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !token) return;
    
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone || null,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Error al guardar");
      }
      
      const data = await response.json();
      const updated = data.user || data;
      setProfile(updated);
      toast.success("Perfil actualizado correctamente");
    } catch (err) {
      toast.error("Error al guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !token) return;
    
    // Validations
    if (!passwordData.currentPassword) {
      toast.error("Ingresa tu contraseña actual");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    
    setChangingPassword(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${user.id}/password`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Error al cambiar contraseña");
      }
      
      toast.success("Contraseña actualizada correctamente");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto" />
              <p className="mt-4 text-slate-400">Cargando perfil...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
              <h2 className="mt-4 text-xl font-semibold text-white">Error</h2>
              <p className="mt-2 text-slate-400">No se pudo cargar el perfil</p>
              <Button onClick={() => navigate("/")} className="mt-4">
                Volver al inicio
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Inicio
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Profile Header */}
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20 border-2 border-cyan-500/50">
                <AvatarImage src="" />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-500 text-2xl font-bold">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
                <p className="text-slate-400">{profile.email}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Badge
                    variant="secondary"
                    className={
                      profile.role === "ADMIN"
                        ? "bg-purple-500/20 text-purple-300"
                        : profile.role === "OPERATOR"
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-slate-500/20 text-slate-300"
                    }
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {profile.role}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={
                      profile.status === "ACTIVE"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-red-500/20 text-red-300"
                    }
                  >
                    {profile.status === "ACTIVE" ? "Activo" : profile.status}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <Link to="/my-tickets">
                  <Button variant="outline" size="sm">
                    <Ticket className="h-4 w-4 mr-2" />
                    Mis Boletos
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-cyan-400" />
              Información de la cuenta
            </CardTitle>
            <CardDescription>
              Actualiza tu información personal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Nombre completo</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Tu nombre"
                  className="border-white/20 bg-white/5"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Teléfono</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+52 55 1234 5678"
                  className="border-white/20 bg-white/5"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-slate-300">Email</Label>
              <Input
                value={profile.email}
                disabled
                className="border-white/20 bg-white/5 opacity-50"
              />
              <p className="text-xs text-slate-500">
                El email no se puede cambiar
              </p>
            </div>
            
            <div className="flex justify-end">
              <Button
                onClick={handleSaveProfile}
                disabled={saving}
                className="bg-cyan-500 hover:bg-cyan-600"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar cambios
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-400" />
              Cambiar contraseña
            </CardTitle>
            <CardDescription>
              Actualiza tu contraseña regularmente para mayor seguridad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Contraseña actual</Label>
              <div className="relative">
                <Input
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="••••••••"
                  className="border-white/20 bg-white/5 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    type={showPasswords.new ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="border-white/20 bg-white/5 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Confirmar contraseña</Label>
                <div className="relative">
                  <Input
                    type={showPasswords.confirm ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="border-white/20 bg-white/5 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            
            {passwordData.newPassword && passwordData.confirmPassword && (
              <div className={`flex items-center gap-2 text-sm ${
                passwordData.newPassword === passwordData.confirmPassword
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}>
                {passwordData.newPassword === passwordData.confirmPassword ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Las contraseñas coinciden
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    Las contraseñas no coinciden
                  </>
                )}
              </div>
            )}
            
            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword}
                variant="outline"
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cambiando...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Cambiar contraseña
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Stats */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              Información de la cuenta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-sm text-slate-400">Miembro desde</p>
                <p className="text-lg font-semibold text-white">
                  {format(new Date(profile.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-sm text-slate-400">Último acceso</p>
                <p className="text-lg font-semibold text-white">
                  {profile.lastLogin
                    ? format(new Date(profile.lastLogin), "d 'de' MMMM, yyyy HH:mm", { locale: es })
                    : "Nunca"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader>
            <CardTitle className="text-red-400">Zona de peligro</CardTitle>
            <CardDescription>
              Acciones irreversibles para tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Cerrar sesión</p>
              <p className="text-sm text-slate-400">
                Cerrar sesión en este dispositivo
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  Cerrar sesión
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se cerrará tu sesión actual. Necesitarás iniciar sesión de nuevo para acceder a tu cuenta.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout}>
                    Cerrar sesión
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
