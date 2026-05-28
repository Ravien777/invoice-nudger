// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import InvoiceTable from "@/app/components/InvoiceTable";

const mockInvoice = {
  id: "inv-1",
  invoiceNumber: "INV-001",
  clientName: "Test Client",
  clientEmail: "client@test.com",
  clientPhone: null,
  projectName: null,
  amount: 1000,
  currency: "USD",
  dueDate: "2026-06-15",
  status: "unpaid",
  notes: null,
  source: null,
  paymentLink: null,
  paidAt: null,
  reconciliationStatus: null,
  promiseStatus: null,
  promisedDate: null,
  promiseConfidence: null,
  lateFeeEnabled: false,
  lateFeeAmount: 0,
  interestRate: 0,
  accruedFees: 0,
  feeCap: 0,
  paymentProbability: null,
  createdAt: "2026-05-01",
  updatedAt: "2026-05-01",
};

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children?: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
  success: vi.fn(),
  error: vi.fn(),
  toast: vi.fn(),
}));

describe("InvoiceTable", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("renders empty state when no invoices", () => {
    render(
      <InvoiceTable
        invoices={[]}
        scheduleSteps={[]}
      />,
    );
    expect(screen.getByText("No invoices found")).toBeInTheDocument();
  });

  it("renders invoice rows when invoices exist", () => {
    render(
      <InvoiceTable
        invoices={[mockInvoice]}
        scheduleSteps={[]}
      />,
    );
    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("Test Client")).toBeInTheDocument();
  });

  it("renders action buttons as icons (no text labels)", () => {
    render(
      <InvoiceTable
        invoices={[mockInvoice]}
        scheduleSteps={[{ emailTemplate: "gentle_reminder", daysOffset: -3 }]}
        onGenerateAI={vi.fn()}
      />,
    );
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.queryByText("Payment Link")).not.toBeInTheDocument();
    expect(screen.queryByText("Mark Paid")).not.toBeInTheDocument();
    expect(screen.queryByText("Send Reminder")).not.toBeInTheDocument();
    expect(screen.queryByText("Generate AI")).not.toBeInTheDocument();
  });

  it("renders Edit as a link with Pencil icon", () => {
    render(
      <InvoiceTable
        invoices={[mockInvoice]}
        scheduleSteps={[]}
      />,
    );
    const editLink = screen.getByTitle("Edit");
    expect(editLink.tagName).toBe("A");
    expect(editLink).toHaveAttribute("href", "/invoices/inv-1/edit");
    expect(editLink.querySelector("svg")).toBeTruthy();
  });

  it("renders Delete as a button with Trash2 icon", () => {
    render(
      <InvoiceTable
        invoices={[mockInvoice]}
        scheduleSteps={[]}
      />,
    );
    const deleteBtn = screen.getByTitle("Delete");
    expect(deleteBtn.tagName).toBe("BUTTON");
    expect(deleteBtn.querySelector("svg")).toBeTruthy();
  });

  it("renders Payment Link and Mark Paid buttons for unpaid invoice", () => {
    render(
      <InvoiceTable
        invoices={[mockInvoice]}
        scheduleSteps={[]}
      />,
    );
    expect(screen.getByTitle("Payment Link")).toBeInTheDocument();
    expect(screen.getByTitle("Mark Paid")).toBeInTheDocument();
  });

  it("renders Send Reminder button when scheduleSteps provided", () => {
    render(
      <InvoiceTable
        invoices={[mockInvoice]}
        scheduleSteps={[{ emailTemplate: "gentle_reminder", daysOffset: -3 }]}
      />,
    );
    expect(screen.getByTitle("Send Reminder")).toBeInTheDocument();
  });

  it("renders Generate AI button when onGenerateAI and scheduleSteps provided", () => {
    render(
      <InvoiceTable
        invoices={[mockInvoice]}
        scheduleSteps={[{ emailTemplate: "gentle_reminder", daysOffset: -3 }]}
        onGenerateAI={vi.fn()}
      />,
    );
    expect(screen.getByTitle("Generate AI")).toBeInTheDocument();
  });
});
