export function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
    plan: "pro",
    lastPayYourselfDate: null,
    businessProfile: {
      id: "bp-1",
      userId: "test-user-id",
      taxRate: 30,
      fiscalYearStart: 1,
      taxSavingsAmount: 0,
      baseCurrency: "USD",
      defaultHourlyRate: null,
    },
    ...overrides,
  };
}

export function mockExpense(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    userId: "test-user-id",
    description: "Office supplies",
    amount: 150,
    currency: "USD",
    date: new Date("2025-06-01"),
    vendor: "Amazon",
    categoryId: "cat-1",
    receiptUrl: null,
    taxDeductible: true,
    notes: null,
    category: { id: "cat-1", name: "Supplies", color: "#ff0000" },
    ...overrides,
  };
}
