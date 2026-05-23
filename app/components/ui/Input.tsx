"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  icon?: LucideIcon;
  prefix?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon: Icon, prefix, error, className = "", ...rest }, ref) => {
    const borderColor = error
      ? "border-[--danger] focus:border-[--danger] focus:ring-[--danger]"
      : "border-[--border] focus:border-[--accent] focus:ring-[--accent]";

    const baseInput = `w-full bg-[--bg-elevated] border rounded-[--radius-sm] px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-disabled] focus:outline-none focus:ring-1 transition-colors ${borderColor}`;

    if (Icon) {
      return (
        <div className="relative">
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
          <input
            ref={ref}
            className={`${baseInput} pl-9 ${className}`}
            {...rest}
          />
        </div>
      );
    }

    if (prefix) {
      return (
        <div className="flex">
          <span className="inline-flex items-center px-3 text-sm text-[--text-muted] bg-[--bg-subtle] border border-r-0 border-[--border] rounded-l-[--radius-sm] rounded-r-none">
            {prefix}
          </span>
          <input
            ref={ref}
            className={`${baseInput} rounded-l-none rounded-r-[--radius-sm] ${className}`}
            {...rest}
          />
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={`${baseInput} ${className}`}
        {...rest}
      />
    );
  },
);

Input.displayName = "Input";
export { Input };
export type { InputProps };
