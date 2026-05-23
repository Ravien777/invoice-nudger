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
    "bg-[--accent] hover:bg-[--accent-hover] text-white font-medium",
  secondary:
    "bg-[--bg-subtle] hover:bg-[--border] text-[--text-primary] border border-[--border]",
  ghost:
    "bg-transparent hover:bg-[--bg-subtle] text-[--text-secondary] hover:text-[--text-primary]",
  danger:
    "bg-[--danger]/10 hover:bg-[--danger]/20 text-[--danger] border border-[--danger]/30",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5 rounded-[--radius-sm]",
  md: "text-sm px-4 py-2 rounded-[--radius-sm]",
  lg: "text-sm px-5 py-2.5 rounded-[--radius-md]",
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

    const base = `inline-flex items-center justify-center gap-2 transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

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
