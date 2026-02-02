import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Ticket,
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
import { API_BASE_URL } from "@/lib/api-base";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  lastLogin: string | null;
  stats?: {
    totalOrders: number;
    totalSpent: number;
    ticketCount: number;
  };
}

export default function UserProfile() {
  const { user, token } = useAuth();
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
      navigate("/login", { state: { from: "/mi-cuenta/perfil" } });
      return;
    }
    fetchProfile();
  }, [user, token]);

  const fetchProfile = async () => {
    if (!user || !token) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        const userData = data?.user ?? data;
        setProfile(userData);
        setFormData({
          name: userData.name || "",
          phone: userData.phone || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Error al cargar el perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!token) return;
    
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile((prev) => (prev ? { ...prev, ...data } : { ...data }));
        toast.success("Perfil actualizado correctamente");
      } else {
        const error = await response.json();
        toast.error(error.message || "Error al actualizar el perfil");
      }
    } catch (error) {
      toast.error("Error al actualizar el perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (response.ok) {
        toast.success("Contraseña actualizada correctamente");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const error = await response.json();
        toast.error(error.message || "Error al cambiar la contraseña");
      }
    } catch (error) {
      toast.error("Error al cambiar la contraseña");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <Skeleton className="mb-2 h-6 sm:h-8 w-40 sm:w-48 bg-white/10" />
          <Skeleton className="h-4 w-52 sm:w-64 bg-white/10" />
        </div>
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <Skeleton className="mb-4 h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/10" />
          <Skeleton className="h-5 sm:h-6 w-36 sm:w-40 bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-white">
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20">
            <User className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
          </div>
          Mi Perfil
        </h1>
        <p className="mt-1 text-sm sm:text-base text-slate-400">Administra tu información personal</p>
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-2xl sm:text-3xl font-bold text-slate-900">
            {profile?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">{profile?.name}</h2>
            <p className="text-sm sm:text-base text-slate-400">{profile?.email}</p>
            <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/50 bg-cyan-500/20 px-2 py-0.5 text-[10px] sm:text-xs text-cyan-300">
                <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {profile?.role === "ADMIN" ? "Administrador" : "Usuario"}
              </span>
              {profile?.status === "ACTIVE" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 text-[10px] sm:text-xs text-emerald-300">
                  <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Activo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-4 sm:mb-6 grid grid-cols-3 gap-2 sm:gap-4 border-t border-b border-white/10 py-3 sm:py-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 sm:gap-2 text-slate-400">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-[10px] sm:text-xs">Miembro</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-white">
              {profile?.createdAt
                ? format(new Date(profile.createdAt), "d MMM yy", { locale: es })
                : "-"}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 sm:gap-2 text-slate-400">
              <Ticket className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-[10px] sm:text-xs">Compras</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-white">{profile?.stats?.totalOrders ?? 0}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 sm:gap-2 text-slate-400">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-[10px] sm:text-xs">Último acceso</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-white">
              {profile?.lastLogin
                ? format(new Date(profile.lastLogin), "d MMM yy", { locale: es })
                : "Nunca"}
            </p>
          </div>
        </div>

        {/* Edit Form */}
        <div className="space-y-4">
          <div>
            <Label className="text-slate-300">Nombre completo</Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                placeholder="Tu nombre"
              />
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Correo electrónico</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={profile?.email || ""}
                disabled
                className="border-white/10 bg-white/5 pl-9 text-slate-400"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">El correo no se puede cambiar</p>
          </div>

          <div>
            <Label className="text-slate-300">Teléfono</Label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                placeholder="Tu teléfono"
              />
            </div>
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-violet-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="mb-3 sm:mb-4 flex items-center gap-2">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-rose-400/20 to-rose-600/20">
            <Lock className="h-3 w-3 sm:h-4 sm:w-4 text-rose-400" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-white">Cambiar Contraseña</h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-slate-300">Contraseña actual</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type={showPasswords.current ? "text" : "password"}
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
                className="border-white/10 bg-white/5 pl-9 pr-10 text-white placeholder:text-slate-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() =>
                  setShowPasswords({ ...showPasswords, current: !showPasswords.current })
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPasswords.current ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Nueva contraseña</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type={showPasswords.new ? "text" : "password"}
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
                className="border-white/10 bg-white/5 pl-9 pr-10 text-white placeholder:text-slate-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Confirmar nueva contraseña</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type={showPasswords.confirm ? "text" : "password"}
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                className="border-white/10 bg-white/5 pl-9 pr-10 text-white placeholder:text-slate-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() =>
                  setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPasswords.confirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {passwordData.newPassword &&
            passwordData.confirmPassword &&
            passwordData.newPassword !== passwordData.confirmPassword && (
              <p className="flex items-center gap-1 text-sm text-rose-400">
                <AlertCircle className="h-4 w-4" />
                Las contraseñas no coinciden
              </p>
            )}

          <Button
            onClick={handleChangePassword}
            disabled={
              changingPassword ||
              !passwordData.currentPassword ||
              !passwordData.newPassword ||
              passwordData.newPassword !== passwordData.confirmPassword
            }
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            {changingPassword ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Cambiar Contraseña
          </Button>
        </div>
      </div>
    </div>
  );
}
