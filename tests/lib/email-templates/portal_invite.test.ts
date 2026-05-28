import { describe, it, expect } from "vitest";
import { portalInviteEmail } from "@/lib/email-templates/portal_invite";

describe("portalInviteEmail", () => {
  it("includes the portal URL in the body", () => {
    const result = portalInviteEmail({
      businessName: "Acme Corp",
      portalUrl: "https://app.example.com/portal/abc123",
    });

    expect(result.html).toContain("https://app.example.com/portal/abc123");
  });

  it("includes the business name in the subject", () => {
    const result = portalInviteEmail({
      businessName: "Acme Corp",
      portalUrl: "https://app.example.com/portal/abc123",
    });

    expect(result.subject).toContain("Acme Corp");
    expect(result.subject).toContain("Client Portal");
  });

  it("greets the client by name when provided", () => {
    const result = portalInviteEmail({
      businessName: "Acme Corp",
      clientName: "Jane",
      portalUrl: "https://app.example.com/portal/abc123",
    });

    expect(result.html).toContain("Hi Jane");
  });

  it("uses generic greeting when clientName is not provided", () => {
    const result = portalInviteEmail({
      businessName: "Acme Corp",
      portalUrl: "https://app.example.com/portal/abc123",
    });

    expect(result.html).toContain("Hi there");
  });

  it("mentions invoices and quotes in the body", () => {
    const result = portalInviteEmail({
      businessName: "Acme Corp",
      portalUrl: "https://app.example.com/portal/abc123",
    });

    expect(result.html).toContain("invoices");
    expect(result.html).toContain("quotes");
  });

  it("includes expiry notice of 90 days", () => {
    const result = portalInviteEmail({
      businessName: "Acme Corp",
      portalUrl: "https://app.example.com/portal/abc123",
    });

    expect(result.html).toContain("90 days");
  });
});
