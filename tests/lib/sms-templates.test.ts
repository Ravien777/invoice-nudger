import { describe, it, expect } from "vitest";
import { getSMSTemplate } from "@/lib/sms-templates";

const baseInvoice = {
  clientName: "John Doe",
  amount: 1500,
  currency: "USD",
  dueDate: new Date("2025-07-01"),
  invoiceNumber: "INV-001",
  paymentLink: "https://pay.maroni.com/inv-001",
};

describe("SMS templates", () => {
  it("gentle_reminder returns body text", () => {
    const tpl = getSMSTemplate("gentle_reminder");
    expect(tpl).not.toBeNull();
    const result = tpl!(baseInvoice);
    expect(result).toHaveProperty("body");
    expect(result.body).toContain("John");
  });

  it("due_today includes invoice number", () => {
    const tpl = getSMSTemplate("due_today");
    expect(tpl).not.toBeNull();
    const result = tpl!(baseInvoice);
    expect(result.body).toContain("INV-001");
  });

  it("overdue_notice includes amount", () => {
    const tpl = getSMSTemplate("overdue_notice");
    expect(tpl).not.toBeNull();
    const result = tpl!(baseInvoice);
    expect(result.body).toContain("1,500");
  });

  it("firm_reminder returns body", () => {
    const tpl = getSMSTemplate("firm_reminder");
    expect(tpl).not.toBeNull();
    const result = tpl!(baseInvoice);
    expect(result).toHaveProperty("body");
  });

  it("final_notice has urgent language", () => {
    const tpl = getSMSTemplate("final_notice");
    expect(tpl).not.toBeNull();
    const result = tpl!(baseInvoice);
    expect(result.body.toLowerCase()).toContain("final");
  });

  it("broken_promise_notice mentions previously indicated", () => {
    const tpl = getSMSTemplate("broken_promise_notice");
    expect(tpl).not.toBeNull();
    const result = tpl!(baseInvoice);
    expect(result.body.toLowerCase()).toContain("previously indicated");
  });

  it("returns null for unknown template name", () => {
    expect(getSMSTemplate("nonexistent")).toBeNull();
  });

  it("all templates produce unique bodies", () => {
    const bodies = new Set<string>();
    const names = ["gentle_reminder", "due_today", "overdue_notice", "firm_reminder", "final_notice", "broken_promise_notice"];
    for (const name of names) {
      const tpl = getSMSTemplate(name);
      expect(tpl).not.toBeNull();
      const result = tpl!(baseInvoice);
      bodies.add(result.body);
    }
    expect(bodies.size).toBe(names.length);
  });
});
