interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string | null;
  clientName: string;
  clientEmail: string;
  clientAddress: string | null;
  amount: number;
  subtotal?: number;
  totalTax?: number;
  currency: string;
  dueDate: string;
  issueDate: string;
  status: string;
  notes: string | null;
  sellerName?: string | null;
  sellerAddress?: string | null;
  sellerTaxId?: string | null;
  buyerTaxId?: string | null;
  poNumber?: string | null;
  invoiceType?: string;
  lineItems?: InvoiceLineItem[];
  paymentLink?: string | null;
}

interface BusinessProfileData {
  businessName?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  taxId?: string | null;
}

interface InvoiceTemplateProps {
  invoice: InvoiceData;
  businessProfile?: BusinessProfileData;
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function InvoiceTemplate({
  invoice,
  businessProfile,
}: InvoiceTemplateProps) {
  const isCreditNote = invoice.invoiceType === "credit-note";
  const docLabel = isCreditNote ? "CREDIT NOTE" : "INVOICE";
  const lineItems = invoice.lineItems ?? [];
  const subtotal = invoice.subtotal ?? invoice.amount;
  const totalTax = invoice.totalTax ?? 0;

  return (
    <div className="bg-white text-[#1a1a1a] font-sans p-10 max-w-[800px] mx-auto print:p-0 print:shadow-none print:max-w-none">
      {/* Print-specific styles */}
      <style>{`
        @media print {
          table { page-break-inside: auto; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Accent line */}
      <div className="border-t-2 border-[#4f46e5] mb-8 print:border-t print:border-[#4f46e5]" />

      {/* Header */}
      <div className="flex justify-between items-start mb-10">
        <div>
          {businessProfile?.logoUrl && (
            <img
              src={businessProfile.logoUrl}
              alt="Logo"
              className="h-12 mb-3 object-contain print:h-10"
            />
          )}
          <p className="text-sm font-medium text-[#1a1a1a]">
            {businessProfile?.businessName || "Your Business"}
          </p>
          {businessProfile?.address && (
            <p className="text-xs text-[#6b7280] whitespace-pre-line">
              {businessProfile.address}
            </p>
          )}
          {invoice.sellerTaxId && (
            <p className="text-xs text-[#6b7280] mt-1">
              Tax No: {invoice.sellerTaxId}
            </p>
          )}
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-semibold text-[#1a1a1a] tracking-tight">
            {docLabel}
          </h1>
          <p className="text-[11px] text-[#6b7280] mt-1">
            {invoice.invoiceNumber || ""}
          </p>
          {invoice.poNumber && (
            <p className="text-[11px] text-[#6b7280]">
              PO Number: {invoice.poNumber}
            </p>
          )}
          {isCreditNote && invoice.invoiceNumber && (
            <p className="text-[11px] text-[#6b7280]">
              Credits Invoice: {invoice.invoiceNumber}
            </p>
          )}
        </div>
      </div>

      {/* Bill to */}
      <div className="flex justify-between mb-10">
        <div>
          <p className="text-[11px] text-[#6b7280] uppercase font-medium mb-1">
            Bill To
          </p>
          <p className="text-sm font-medium text-[#1a1a1a]">
            {invoice.clientName}
          </p>
          <p className="text-xs text-[#6b7280]">{invoice.clientEmail}</p>
          {invoice.clientAddress && (
            <p className="text-xs text-[#6b7280] whitespace-pre-line">
              {invoice.clientAddress}
            </p>
          )}
          {invoice.buyerTaxId && (
            <p className="text-xs text-[#6b7280] mt-1">
              VAT No: {invoice.buyerTaxId}
            </p>
          )}
        </div>
        <div className="text-right text-xs text-[#6b7280]">
          <p>
            <span className="text-[11px] text-[#6b7280] uppercase">Issued:</span>{" "}
            {formatDate(invoice.issueDate)}
          </p>
          <p className="mt-0.5">
            <span className="text-[11px] text-[#6b7280] uppercase">Due:</span>{" "}
            {formatDate(invoice.dueDate)}
          </p>
        </div>
      </div>

      {/* Line items */}
      {lineItems.length > 0 ? (
        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="border-b border-[#e5e7eb]">
              <th className="text-left py-2 text-[11px] text-[#6b7280] uppercase font-medium">
                Description
              </th>
              <th className="text-right py-2 text-[11px] text-[#6b7280] uppercase font-medium">
                Qty
              </th>
              <th className="text-right py-2 text-[11px] text-[#6b7280] uppercase font-medium">
                Price
              </th>
              <th className="text-right py-2 text-[11px] text-[#6b7280] uppercase font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} className="border-b border-[#e5e7eb]">
                <td className="py-3 text-sm text-[#1a1a1a]">
                  {item.description}
                  {item.taxRate ? (
                    <span className="text-[11px] text-[#6b7280] ml-1">
                      ({item.taxRate}% GST)
                    </span>
                  ) : null}
                </td>
                <td className="py-3 text-right text-sm text-[#6b7280]">
                  {item.quantity}
                </td>
                <td className="py-3 text-right text-sm text-[#6b7280]">
                  {formatCurrency(item.unitPrice, invoice.currency)}
                </td>
                <td className="py-3 text-right text-sm font-medium text-[#1a1a1a]">
                  {formatCurrency(item.total, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mb-8 py-4 border-y border-[#e5e7eb]">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#6b7280]">Total Amount</span>
            <span className="text-base font-semibold text-[#1a1a1a]">
              {formatCurrency(invoice.amount, invoice.currency)}
            </span>
          </div>
        </div>
      )}

      {/* Totals */}
      {lineItems.length > 0 && (
        <div className="flex justify-end mb-8">
          <div className="w-64">
            <div className="flex justify-between py-1 text-sm text-[#6b7280]">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, invoice.currency)}</span>
            </div>
            {totalTax > 0 && (
              <div className="flex justify-between py-1 text-sm text-[#6b7280]">
                <span>Tax</span>
                <span>{formatCurrency(totalTax, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 text-base font-semibold text-[#1a1a1a] border-t border-[#e5e7eb] mt-1">
              <span>Total</span>
              <span>{formatCurrency(invoice.amount, invoice.currency)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Notes & Payment */}
      <div className="flex justify-between items-end">
        <div>
          {invoice.notes && (
            <div className="text-xs text-[#6b7280] max-w-xs">
              <p className="text-[11px] uppercase font-medium mb-1">Notes</p>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
        </div>
        {invoice.paymentLink && (
          <a
            href={invoice.paymentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#4f46e5] text-white text-sm font-medium px-5 py-2.5 rounded-md hover:bg-[#4338ca] transition-colors no-underline print:no-underline print:text-[#4f46e5] print:bg-white print:border print:border-[#4f46e5]"
          >
            Pay Now
          </a>
        )}
      </div>
    </div>
  );
}
