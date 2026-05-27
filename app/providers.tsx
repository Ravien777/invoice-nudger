"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--surface-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: "0.5rem",
          },
        }}
      />
    </SessionProvider>
  );
}
