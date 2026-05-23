"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = "", children, ...rest }, ref) => {
    const borderColor = error
      ? "border-[--danger] focus:border-[--danger] focus:ring-[--danger]"
      : "border-[--border] focus:border-[--accent] focus:ring-[--accent]";

    return (
      <div className="relative">
        <select
          ref={ref}
          className={`w-full appearance-none bg-[--bg-elevated] border rounded-[--radius-sm] px-3 py-2 pr-9 text-sm text-[--text-primary] focus:outline-none focus:ring-1 transition-colors ${borderColor} ${className}`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted] pointer-events-none" />
      </div>
    );
  },
);

Select.displayName = "Select";
export { Select };
export type { SelectProps };
