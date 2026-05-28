// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import InvoicesClient from "@/app/(app)/invoices/InvoicesClient";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children?: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: { user: { email: "test@example.com" } },
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/app/components/CSVUploadModal", () => ({
  default: () => null,
}));

vi.mock("@/app/(app)/invoices/components/AIReminderModal", () => ({
  default: () => null,
}));

vi.mock("@/app/(app)/invoices/components/PortalTokenModal", () => ({
  default: () => null,
}));

vi.mock("@/app/components/ui/Button", () => ({
  Button: ({
    children,
    href,
    className,
    ...props
  }: {
    children?: React.ReactNode;
    href?: string;
    className?: string;
    [key: string]: unknown;
  }) => {
    if (href) return <a href={href} {...props}>{children}</a>;
    return <button className={className} {...props}>{children}</button>;
  },
}));

vi.mock("@/app/components/ui/Select", () => ({
  Select: ({
    children,
    className,
    ...props
  }: {
    children?: React.ReactNode;
    className?: string;
    [key: string]: unknown;
  }) => (
    <select className={className} data-testid="status-select" {...props}>
      {children}
    </select>
  ),
}));

describe("InvoicesClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }));
  });

  function renderClient() {
    return render(
      <InvoicesClient
        initialInvoices={[]}
        scheduleSteps={[]}
        userTone="professional"
        riskScores={{}}
        probabilities={{}}
        userPlan="free"
      />,
    );
  }

  it("renders the page title", () => {
    renderClient();
    expect(screen.getByText("Invoices")).toBeInTheDocument();
  });

  it("renders the New Invoice button", () => {
    renderClient();
    expect(screen.getByText("New Invoice")).toBeInTheDocument();
  });

  it("renders the Import CSV button", () => {
    renderClient();
    expect(screen.getByText("Import CSV")).toBeInTheDocument();
  });

  it("renders a status filter select", () => {
    renderClient();
    expect(screen.getByTestId("status-select")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    renderClient();
    expect(screen.getByPlaceholderText("Search client or invoice...")).toBeInTheDocument();
  });

  it("renders InvoiceTable with empty state", () => {
    renderClient();
    expect(screen.getByText("No invoices found")).toBeInTheDocument();
  });
});
