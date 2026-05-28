import { describe, it, expect } from "vitest";
import { invoiceSchema, expenseSchema, quoteSchema, recurringSchema } from "@/lib/validations";

describe("invoiceSchema", () => {
  const validInvoice = {
    clientName: "John Doe",
    clientEmail: "john@example.com",
    amount: 100,
    dueDate: "2025-06-15",
  };

  it("accepts valid invoice", () => {
    const result = invoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
  });

  it("rejects missing clientName", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, clientName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, clientEmail: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("accepts valid phone in E.164", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, clientPhone: "+12025551234" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid phone", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, clientPhone: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, amount: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, dueDate: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("defaults currency to USD", () => {
    const result = invoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("USD");
    }
  });

  it("accepts empty optional fields", () => {
    const result = invoiceSchema.safeParse({
      ...validInvoice,
      clientPhone: "",
      projectName: "",
      invoiceNumber: "",
      notes: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("expenseSchema", () => {
  const validExpense = {
    description: "Office supplies",
    amount: 50,
    date: "2025-06-01",
  };

  it("accepts valid expense", () => {
    const result = expenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
  });

  it("rejects missing description", () => {
    const result = expenseSchema.safeParse({ ...validExpense, description: "" });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = expenseSchema.safeParse({ ...validExpense, amount: -5 });
    expect(result.success).toBe(false);
  });

  it("defaults currency to USD", () => {
    const result = expenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("USD");
    }
  });

  it("defaults taxDeductible to true", () => {
    const result = expenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taxDeductible).toBe(true);
    }
  });

  it("accepts valid receiptUrl", () => {
    const result = expenseSchema.safeParse({
      ...validExpense,
      receiptUrl: "https://example.com/receipt.pdf",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid receiptUrl", () => {
    const result = expenseSchema.safeParse({
      ...validExpense,
      receiptUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty string receiptUrl", () => {
    const result = expenseSchema.safeParse({
      ...validExpense,
      receiptUrl: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional vendor and categoryId", () => {
    const result = expenseSchema.safeParse({
      ...validExpense,
      vendor: "Amazon",
      categoryId: "cat-1",
      notes: "My note",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date", () => {
    const result = expenseSchema.safeParse({ ...validExpense, date: "bad-date" });
    expect(result.success).toBe(false);
  });

  it("rejects non-3-letter currency", () => {
    const result = expenseSchema.safeParse({ ...validExpense, currency: "US" });
    expect(result.success).toBe(false);
  });
});

describe("quoteSchema", () => {
  const validQuote = {
    clientName: "Acme Corp",
    clientEmail: "billing@acme.com",
    amount: 5000,
    issueDate: "2025-06-01",
  };

  it("accepts valid quote", () => {
    const result = quoteSchema.safeParse(validQuote);
    expect(result.success).toBe(true);
  });

  it("rejects missing clientName", () => {
    const result = quoteSchema.safeParse({ ...validQuote, clientName: "" });
    expect(result.success).toBe(false);
  });

  it("defaults currency to USD", () => {
    const result = quoteSchema.safeParse(validQuote);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("USD");
    }
  });

  it("defaults lineItems to empty array", () => {
    const result = quoteSchema.safeParse(validQuote);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lineItems).toEqual([]);
    }
  });

  it("accepts line items", () => {
    const result = quoteSchema.safeParse({
      ...validQuote,
      lineItems: [
        { description: "Consulting", quantity: 10, unitPrice: 500, total: 5000, sortOrder: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("recurringSchema", () => {
  const validRecurring = {
    clientName: "Jane Doe",
    clientEmail: "jane@example.com",
    amount: 200,
    frequency: "monthly",
    nextRunDate: "2025-07-01",
  };

  it("accepts valid recurring invoice", () => {
    const result = recurringSchema.safeParse(validRecurring);
    expect(result.success).toBe(true);
  });

  it("rejects invalid frequency", () => {
    const result = recurringSchema.safeParse({
      ...validRecurring,
      frequency: "yearly",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid frequencies", () => {
    const frequencies = ["weekly", "biweekly", "monthly", "quarterly", "annually"];
    for (const frequency of frequencies) {
      const result = recurringSchema.safeParse({ ...validRecurring, frequency });
      expect(result.success).toBe(true);
    }
  });

  it("rejects dayOfMonth > 28", () => {
    const result = recurringSchema.safeParse({
      ...validRecurring,
      dayOfMonth: 31,
    });
    expect(result.success).toBe(false);
  });

  it("accepts dayOfMonth 1-28", () => {
    const result = recurringSchema.safeParse({
      ...validRecurring,
      dayOfMonth: 15,
    });
    expect(result.success).toBe(true);
  });
});
