import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Ingresa tu email");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (response.ok) {
        setSent(true);
      } else {
        // Siempre mostrar éxito por seguridad (no revelar si el email existe)
        setSent(true);
      }
    } catch (err) {
      // Aún así mostrar éxito por seguridad
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
        <Card className="w-full max-w-md border-white/10 bg-white/5">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle className="h-10 w-10 text-emerald-400" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-white">¡Revisa tu email!</h2>
            <p className="mb-6 text-slate-400">
              Si existe una cuenta con <span className="text-white">{email}</span>, 
              recibirás un enlace para restablecer tu contraseña.
            </p>
            <div className="space-y-3">
              <Link to="/login">
                <Button className="w-full bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-cyan-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl">
                  Volver a iniciar sesión
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full text-slate-400"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
              >
                Enviar a otro email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <Card className="w-full max-w-md border-white/10 bg-white/5">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/20">
            <Mail className="h-7 w-7 text-cyan-400" />
          </div>
          <CardTitle className="text-2xl text-white">¿Olvidaste tu contraseña?</CardTitle>
          <CardDescription>
            Ingresa tu email y te enviaremos un enlace para restablecerla
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-white/20 bg-white/5"
                autoFocus
              />
            </div>
            
            <Button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-600"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar enlace de recuperación"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-slate-400 hover:text-white"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Volver a iniciar sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
