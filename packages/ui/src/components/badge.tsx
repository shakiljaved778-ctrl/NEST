import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--ui-surface-muted)] text-[var(--ui-text-muted)]",
        brand: "bg-[var(--ui-primary)] text-[var(--ui-primary-contrast)]",
        islamic: "bg-emerald-50 text-emerald-800",
        warning: "bg-amber-50 text-amber-800",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
