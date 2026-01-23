import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import PrismaticBurst from "@/components/PrismaticBurst";
import { UserPlus } from "lucide-react";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromRoute = (location.state as { from?: string } | null)?.from;
  const { toast } = useToast();
  const { register, user, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const getRedirectPath = (userRole?: string) => {
    return userRole === "ADMIN" ? "/admin" : "/mi-cuenta";
  };

  useEffect(() => {
    if (!loading && user) {
      navigate(fromRoute ?? getRedirectPath(user.role), { replace: true });
    }
  }, [loading, user, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const newUser = await register({ name, email, password });
      toast({ title: "Cuenta creada", description: "¡Bienvenido!" });
      navigate(fromRoute ?? getRedirectPath(newUser?.role), { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar";
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = submitting || loading || !name || !email || !password;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505]">
      {/* PrismaticBurst Background */}
      <div className="fixed inset-0 z-0">
        <PrismaticBurst
          colors={['#000000', '#ffc800', '#ffe566']}
          animationType="rotate3d"
          intensity={1.5}
          speed={0.6}
          className="w-full h-full opacity-70"
        />
      </div>

      {/* Liquid Glass Card */}
      <div className="relative z-10 w-full max-w-md mx-3 sm:mx-4">
        <div 
          className="relative overflow-hidden rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 md:p-10"
          style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(20,20,20,0.6) 100%)',
            backdropFilter: 'blur(40px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
            border: '1px solid rgba(255, 200, 0, 0.15)',
            boxShadow: `
              0 0 0 1px rgba(255, 200, 0, 0.1) inset,
              0 0 80px 20px rgba(255, 200, 0, 0.05) inset,
              0 25px 50px -12px rgba(0, 0, 0, 0.8),
              0 0 100px rgba(255, 200, 0, 0.1)
            `
          }}
        >
          {/* Glass reflections */}
          <div className="absolute inset-0 rounded-2xl sm:rounded-[2.5rem] overflow-hidden pointer-events-none">
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-white/10 via-transparent to-transparent rotate-12" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-gold-400/20 to-transparent blur-2xl" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-radial from-amber-500/10 to-transparent blur-3xl" />
          </div>

          {/* Content */}
          <div className="relative z-10 space-y-6 sm:space-y-8">
            {/* Header */}
            <div className="text-center space-y-3 sm:space-y-4">
              <img 
                src="/Sin-titulo-190-x-65-px-1024-x-1024-px-1.png" 
                alt="compratuboleto.mx"
                className="mx-auto h-16 sm:h-20 md:h-24 object-contain"
              />
              <div>
                <p className="text-xs sm:text-sm uppercase tracking-[0.3em] sm:tracking-[0.4em] text-gold-400 mb-1">Nuevo usuario</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Crear Cuenta</h1>
              </div>
            </div>

            {/* Form */}
            <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="name" className="text-white/80 text-xs sm:text-sm">
                  Nombre completo
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tu nombre"
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border-gold-500/20 bg-black/40 text-white placeholder:text-white/30 focus:border-gold-500/50 focus:ring-gold-500/30 backdrop-blur-sm text-sm sm:text-base"
                  required
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="email" className="text-white/80 text-xs sm:text-sm">
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@email.com"
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border-gold-500/20 bg-black/40 text-white placeholder:text-white/30 focus:border-gold-500/50 focus:ring-gold-500/30 backdrop-blur-sm text-sm sm:text-base"
                  required
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="password" className="text-white/80 text-xs sm:text-sm">
                  Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-11 sm:h-12 rounded-xl sm:rounded-2xl border-gold-500/20 bg-black/40 text-white placeholder:text-white/30 focus:border-gold-500/50 focus:ring-gold-500/30 backdrop-blur-sm text-sm sm:text-base"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl text-sm sm:text-base font-semibold bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:from-yellow-400 hover:to-amber-400 shadow-lg shadow-gold-500/30 transition-all hover:shadow-gold-500/50 hover:scale-[1.02]" 
                disabled={isDisabled}
              >
                {submitting ? "Creando cuenta..." : "Crear cuenta"}
              </Button>
            </form>

            {/* Login Link */}
            <p className="text-center text-sm text-white/60">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login" className="text-gold-400 hover:text-gold-300 transition-colors font-medium">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
