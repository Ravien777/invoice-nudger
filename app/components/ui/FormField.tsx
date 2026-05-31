import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({
  label,
  required,
  error,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[--text-secondary]">
        {label}
        {required && <span className="text-[--danger] ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-[--text-muted]">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-[--danger]">{error}</p>
      )}
    </div>
  );
}
