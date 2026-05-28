// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import HeaderActions from "@/app/(app)/components/HeaderActions";

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

vi.mock("@/app/components/ui/Button", () => ({
  Button: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => <button {...props}>{children}</button>,
}));

describe("HeaderActions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    }));
  });

  it("renders the notification bell", () => {
    render(<HeaderActions />);
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  it("renders the sign out button", () => {
    render(<HeaderActions />);
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("does not render a Menu/hamburger icon", () => {
    render(<HeaderActions />);
    expect(screen.queryByTitle("Toggle sidebar")).not.toBeInTheDocument();
  });

  it("renders the user email", () => {
    render(<HeaderActions />);
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("does not call any sidebar toggle function", () => {
    render(<HeaderActions />);
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn.textContent).not.toMatch(/toggle|sidebar|menu/i);
    }
  });
});
