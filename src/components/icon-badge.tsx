import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * IconBadge — filled, rounded container for a Lucide icon (or short text/number).
 * Use to unify size, color, and spacing of decorative icon "chips" across the app.
 */
const iconBadgeVariants = cva(
  "inline-grid place-items-center shrink-0 font-bold",
  {
    variants: {
      size: {
        sm: "h-6 w-6 rounded-md text-[11px] [&>svg]:h-3.5 [&>svg]:w-3.5",
        md: "h-8 w-8 rounded-lg text-xs [&>svg]:h-4 [&>svg]:w-4",
        lg: "h-10 w-10 rounded-xl text-sm [&>svg]:h-5 [&>svg]:w-5",
        xl: "h-14 w-14 rounded-2xl text-base [&>svg]:h-6 [&>svg]:w-6",
      },
      tone: {
        primary: "bg-primary-soft text-primary",
        muted: "bg-muted text-muted-foreground",
        destructive: "bg-destructive/10 text-destructive",
        success: "bg-emerald-100 text-emerald-700",
        warning: "bg-amber-100 text-amber-700",
      },
    },
    defaultVariants: { size: "md", tone: "primary" },
  }
);

export type IconBadgeProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> &
  VariantProps<typeof iconBadgeVariants> & {
    icon?: LucideIcon;
    children?: React.ReactNode;
    /** Accessible label. When omitted, the badge is treated as decorative. */
    label?: string;
  };

export function IconBadge({
  icon: Icon,
  children,
  size,
  tone,
  className,
  label,
  ...rest
}: IconBadgeProps) {
  const isDecorative = !label;
  return (
    <span
      className={cn(iconBadgeVariants({ size, tone }), className)}
      role={isDecorative ? undefined : "img"}
      aria-label={label}
      aria-hidden={isDecorative ? true : undefined}
      {...rest}
    >
      {Icon ? <Icon aria-hidden="true" /> : children}
    </span>
  );
}

/**
 * SectionIcon — inline Lucide icon rendered at a unified size/color, meant to sit
 * next to a section heading or inside a form row. Prefer this over ad-hoc
 * `<Icon className="h-4 w-4 text-primary" />` markup.
 */
const sectionIconVariants = cva("shrink-0", {
  variants: {
    size: {
      sm: "h-3.5 w-3.5",
      md: "h-4 w-4",
      lg: "h-5 w-5",
    },
    tone: {
      primary: "text-primary",
      muted: "text-muted-foreground",
      subtle: "text-primary/70",
      destructive: "text-destructive",
      foreground: "text-foreground",
    },
  },
  defaultVariants: { size: "md", tone: "primary" },
});

export type SectionIconProps = VariantProps<typeof sectionIconVariants> & {
  icon: LucideIcon;
  className?: string;
  label?: string;
};

export function SectionIcon({ icon: Icon, size, tone, className, label }: SectionIconProps) {
  const isDecorative = !label;
  return (
    <Icon
      className={cn(sectionIconVariants({ size, tone }), className)}
      role={isDecorative ? undefined : "img"}
      aria-label={label}
      aria-hidden={isDecorative ? true : undefined}
    />
  );
}
