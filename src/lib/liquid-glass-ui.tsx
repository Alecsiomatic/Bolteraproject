import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type GlassCardVariant = "intense" | "subtle" | "soft";

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: GlassCardVariant;
  interactive?: boolean;
  specular?: boolean;
}

const variantClasses: Record<GlassCardVariant, string> = {
  intense:
    "bg-gradient-to-br from-white/15 via-white/5 to-white/0 border-white/20 shadow-[0_25px_80px_rgba(15,23,42,0.7)]",
  subtle:
    "bg-slate-900/60 border-white/10 shadow-[0_20px_65px_rgba(2,6,23,0.75)]",
  soft: "bg-white/5 border-white/5 shadow-[0_12px_40px_rgba(2,6,23,0.55)]",
};

export function GlassCard({
  children,
  variant = "subtle",
  interactive,
  specular,
  className,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "group/glass relative overflow-hidden rounded-[32px] px-8 py-6 text-white backdrop-blur-[32px] transition-all duration-500",
        variantClasses[variant],
        interactive &&
          "hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_30px_90px_rgba(15,23,42,0.9)] focus-within:-translate-y-1",
        specular &&
          "before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/40 before:via-transparent before:to-transparent before:opacity-40",
        "after:pointer-events-none after:absolute after:inset-0 after:opacity-0 after:transition-all after:duration-500 group-hover/glass:after:opacity-100 after:bg-[radial-gradient(circle_at_80%_-10%,rgba(255,255,255,0.35),transparent_45%)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export const LiquidGlass = {
  GlassCard,
};

export default LiquidGlass;
