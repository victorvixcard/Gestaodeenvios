import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border-primary/20",
        secondary: "bg-secondary text-secondary-foreground border-transparent",
        destructive: "bg-destructive/10 text-destructive border-destructive/20",
        outline: "bg-transparent border-border text-foreground",
        success: "bg-success/10 text-success border-success/20",
        warning: "bg-warning/10 text-warning border-warning/20",
        accent: "bg-accent/10 text-accent border-accent/20",
        muted: "bg-muted text-muted-foreground border-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
