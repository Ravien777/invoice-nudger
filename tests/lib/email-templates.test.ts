import { describe, it, expect } from "vitest";
import { getTemplate } from "@/lib/email-templates";
import { accountantInviteEmail } from "@/lib/email-templates/accountant_invite";

const baseParams = {
  clientName: "John Doe",
  clientEmail: "john@example.com",
  amount: 1500,
  currency: "USD",
  dueDate: new Date("2025-07-01"),
  invoiceNumber: "INV-001",
  paymentLink: "https://pay.maroni.com/inv-001",
};

describe("email templates", () => {
  it("gentle_reminder returns subject and html", () => {
    const tpl = getTemplate("gentle_reminder");
    expect(tpl).not.toBeNull();
    const result = tpl!(baseParams);
    expect(result).toHaveProperty("subject");
    expect(result).toHaveProperty("html");
    expect(result.html).toContain("John");
  });

  it("due_today returns subject with invoice", () => {
    const tpl = getTemplate("due_today");
    expect(tpl).not.toBeNull();
    const result = tpl!(baseParams);
    expect(result.html).toContain("INV-001");
  });

  it("overdue_notice includes amount", () => {
    const tpl = getTemplate("overdue_notice");
    expect(tpl).not.toBeNull();
    const result = tpl!(baseParams);
    expect(result.html).toContain("1,500");
  });

  it("firm_reminder returns subject and html", () => {
    const tpl = getTemplate("firm_reminder");
    expect(tpl).not.toBeNull();
    const result = tpl!(baseParams);
    expect(result).toHaveProperty("subject");
    expect(result).toHaveProperty("html");
  });

  it("final_notice has urgent language", () => {
    const tpl = getTemplate("final_notice");
    expect(tpl).not.toBeNull();
    const result = tpl!(baseParams);
    expect(result.subject.toLowerCase()).toContain("final");
  });

  it("broken_promise_notice requires promisedDate", () => {
    const tpl = getTemplate("broken_promise_notice");
    expect(tpl).not.toBeNull();
    const result = tpl!({ ...baseParams, promisedDate: new Date("2025-06-20") });
    expect(result).toHaveProperty("subject");
    expect(result).toHaveProperty("html");
    expect(result.subject.toLowerCase()).toContain("overdue");
  });

  it("accountant_invite includes invite link", () => {
    const result = accountantInviteEmail({
      ownerName: "John Doe",
      ownerEmail: "john@example.com",
      inviteUrl: "https://app.maroni.com/accept?token=abc123",
    });
    expect(result.html).toContain("abc123");
    expect(result.html).toContain("John Doe");
    expect(result.html).toContain("john@example.com");
  });

  it("returns null for unknown template name", () => {
    expect(getTemplate("nonexistent")).toBeNull();
  });

  it("all templates produce unique subjects", () => {
    const subjects = new Set<string>();
    const names = ["gentle_reminder", "due_today", "overdue_notice", "firm_reminder", "final_notice", "broken_promise_notice"];
    for (const name of names) {
      const tpl = getTemplate(name);
      expect(tpl).not.toBeNull();
      const params = name === "broken_promise_notice"
        ? { ...baseParams, promisedDate: new Date("2025-06-20") }
        : baseParams;
      const result = tpl!(params);
      subjects.add(result.subject);
    }
    expect(subjects.size).toBe(names.length);
  });
});
