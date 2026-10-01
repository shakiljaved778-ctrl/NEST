import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--ui-radius,12px)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--ui-primary)] text-[var(--ui-primary-contrast)] hover:opacity-90",
        secondary: "bg-[var(--ui-surface-muted)] text-[var(--ui-text)] hover:opacity-90",
        outline:
          "border border-[var(--ui-border)] bg-transparent text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]",
        ghost: "bg-transparent text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]",
        destructive: "bg-[var(--ui-critical)] text-white hover:opacity-90",
        link: "bg-transparent text-[var(--ui-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  block,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}
