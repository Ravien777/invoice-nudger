"use client";

import { type LucideIcon } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-[--text-disabled] mb-4" />
      <h3 className="text-base font-medium text-[--text-secondary]">{title}</h3>
      <p className="text-sm text-[--text-muted] mt-1 max-w-xs">{description}</p>
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
