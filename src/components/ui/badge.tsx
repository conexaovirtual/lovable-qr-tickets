import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        info: "border-transparent bg-info text-info-foreground",
        // Status badges
        novo: "border-transparent bg-info text-info-foreground",
        triagem: "border-transparent bg-warning/20 text-warning-foreground border-warning",
        em_atendimento: "border-transparent bg-primary/20 text-primary border-primary",
        aguardando_usuario: "border-transparent bg-warning text-warning-foreground",
        aguardando_peca: "border-transparent bg-warning/60 text-warning-foreground",
        resolvido: "border-transparent bg-success/20 text-success border-success",
        validando_cliente: "border-transparent bg-info/20 text-info border-info",
        fechado: "border-transparent bg-muted text-muted-foreground",
        // Priority badges
        critica: "border-transparent bg-destructive text-destructive-foreground",
        alta: "border-transparent bg-warning text-warning-foreground",
        media: "border-transparent bg-info text-info-foreground",
        baixa: "border-transparent bg-success text-success-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
