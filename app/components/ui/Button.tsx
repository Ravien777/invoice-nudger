"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  loading?: boolean;
}

interface ButtonAsButton extends ButtonBaseProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> {
  href?: undefined;
}

interface ButtonAsLink extends ButtonBaseProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover font-medium",
  secondary:
    "bg-surface-tertiary text-text-primary border border-border-default hover:bg-surface-secondary",
  ghost:
    "bg-transparent text-text-secondary hover:bg-surface-tertiary",
  danger:
    "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-sm px-3 py-1.5 rounded-md",
  md: "text-sm px-4 py-2 rounded-md",
  lg: "text-base px-6 py-3 rounded-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const {
      variant = "primary",
      size = "md",
      icon: Icon,
      iconPosition = "left",
      loading = false,
      className = "",
      children,
      ...rest
    } = props as ButtonAsButton;

    const base = `inline-flex items-center justify-center gap-2 transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

    const content = (
      <>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : Icon && iconPosition === "left" ? (
          <Icon className="h-4 w-4" />
        ) : null}
        {children}
        {Icon && iconPosition === "right" && !loading ? (
          <Icon className="h-4 w-4" />
        ) : null}
      </>
    );

    if ("href" in props && props.href) {
      return (
        <Link href={props.href} className={base}>
          {content}
        </Link>
      );
    }

    return (
      <button ref={ref} className={base} disabled={loading} {...rest}>
        {content}
      </button>
    );
  },
);

Button.displayName = "Button";
export { Button };
export type { ButtonVariant, ButtonSize, ButtonProps };
