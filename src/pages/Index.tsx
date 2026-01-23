import { Canvas } from "@/components/Canvas";
import { MapPin } from "lucide-react";

const Index = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#010512] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.2),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 translate-x-28 bg-gradient-to-b from-purple-600/20 via-transparent to-cyan-500/20 blur-[140px]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Canvas</p>
              <h1 className="text-2xl font-semibold">Sistema de Boletería</h1>
              <p className="text-sm text-slate-400">Creador de Mapas de Asientos y Zonas</p>
            </div>
          </div>
        </header>
        <main className="flex-1">
          <Canvas />
        </main>
      </div>
    </div>
  );
};

export default Index;
