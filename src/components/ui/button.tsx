import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold tracking-wide ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-yellow-400/90 via-amber-400/80 to-yellow-500/90 text-black border border-yellow-300/40 shadow-[0_8px_32px_rgba(255,200,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_12px_40px_rgba(255,200,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)] hover:from-yellow-300/95 hover:to-amber-400/95 backdrop-blur-xl",
        destructive:
          "bg-gradient-to-br from-rose-500/80 via-red-500/70 to-rose-600/80 text-white border border-rose-400/30 shadow-[0_8px_32px_rgba(248,113,113,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(248,113,113,0.4)] backdrop-blur-xl",
        outline:
          "border border-white/20 bg-white/5 text-white/90 hover:border-white/30 hover:bg-white/10 hover:text-white backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.1)]",
        secondary:
          "bg-gradient-to-br from-white/15 via-white/10 to-white/5 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)]",
        ghost: 
          "text-white/80 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10 backdrop-blur-sm",
        link: "text-gold-400 underline-offset-4 hover:text-gold-300",
        // New liquid glass variant
        glass:
          "bg-gradient-to-br from-white/15 via-white/8 to-white/5 text-white border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.15)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)] hover:bg-white/20 hover:border-white/30 backdrop-blur-xl backdrop-saturate-150",
        // Gold glass variant
        goldGlass:
          "bg-gradient-to-br from-yellow-500/20 via-amber-400/15 to-yellow-500/10 text-yellow-300 border border-yellow-400/30 shadow-[0_8px_32px_rgba(255,200,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] hover:shadow-[0_12px_40px_rgba(255,200,0,0.25),inset_0_1px_2px_rgba(255,255,255,0.2)] hover:from-yellow-500/25 hover:border-yellow-400/40 backdrop-blur-xl backdrop-saturate-150",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-2xl px-3",
        lg: "h-12 rounded-2xl px-8 text-base",
        icon: "h-11 w-11 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
