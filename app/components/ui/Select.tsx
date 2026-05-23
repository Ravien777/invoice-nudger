"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = "", children, ...rest }, ref) => {
    const borderColor = error
      ? "border-danger focus:ring-danger"
      : "border-border-default focus:ring-accent focus:border-accent";

    return (
      <div className="relative">
        <select
          ref={ref}
          className={`w-full appearance-none bg-surface-tertiary border rounded-md px-3 py-2 pr-9 text-sm text-text-primary focus:outline-none focus:ring-2 transition-colors ${borderColor} ${className}`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
      </div>
    );
  },
);

Select.displayName = "Select";
export { Select };
export type { SelectProps };
