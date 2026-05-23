"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description: string;
  children?: ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({
  title,
  description,
  children,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {children && <div className="mb-4">{children}</div>}
      <h3 className="text-base font-medium text-text-secondary">{title}</h3>
      <p className="text-sm text-text-secondary mt-1 max-w-xs">{description}</p>
      {action && (
        <div className="mt-4">
          <Button
            variant="primary"
            {...(action.href ? { href: action.href } : { onClick: action.onClick })}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
