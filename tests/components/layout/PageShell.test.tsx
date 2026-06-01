// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageShell } from "@/app/components/layout/PageShell";
import { SidebarProvider } from "@/app/components/layout/SidebarProvider";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: { user: { email: "test@example.com" } },
  })),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/app/components/layout/NotificationBell", () => ({
  NotificationBell: () => <span data-testid="notification-bell">Bell</span>,
}));

import { SessionProvider } from "next-auth/react";

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <SessionProvider>
      <SidebarProvider>{ui}</SidebarProvider>
    </SessionProvider>,
  );
}

describe("PageShell", () => {
  it("renders the title", () => {
    renderWithProvider(
      <PageShell title="Test Title">
        <p>content</p>
      </PageShell>,
    );
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    renderWithProvider(
      <PageShell title="Title" subtitle="A subtitle">
        <p>content</p>
      </PageShell>,
    );
    expect(screen.getByText("A subtitle")).toBeInTheDocument();
  });

  it("does not render subtitle when not provided", () => {
    renderWithProvider(
      <PageShell title="Title">
        <p>content</p>
      </PageShell>,
    );
    expect(screen.queryByText("A subtitle")).not.toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    renderWithProvider(
      <PageShell title="Title" actions={<button>Action</button>}>
        <p>content</p>
      </PageShell>,
    );
    expect(screen.getByText("Action")).toBeInTheDocument();
  });

  it("renders a mobile hamburger button with md:hidden", () => {
    renderWithProvider(
      <PageShell title="Title">
        <p>content</p>
      </PageShell>,
    );
    const buttons = screen.getAllByRole("button");
    const hamburger = buttons.find(
      (b) => b.classList.contains("md:hidden"),
    );
    expect(hamburger).toBeTruthy();
    expect(hamburger?.querySelector("svg")).toBeTruthy();
  });

  it("renders children content", () => {
    renderWithProvider(
      <PageShell title="Title">
        <p>child content</p>
      </PageShell>,
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
