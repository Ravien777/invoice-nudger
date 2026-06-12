import React from "react";
import { formatCurrency } from "./format-currency";

interface PayslipProps {
  businessName: string;
  businessAddress: string;
  contractorName: string;
  contractorEmail: string;
  contractorTaxId: string | null;
  amount: number;
  currency: string;
  description: string;
  paymentDate: Date;
}

export async function generatePayslipPdf(props: PayslipProps): Promise<Buffer> {
  const ReactPDF = await import("@react-pdf/renderer");

  const PayslipDocument = ({
    businessName,
    businessAddress,
    contractorName,
    contractorEmail,
    contractorTaxId,
    amount,
    currency,
    description,
    paymentDate,
  }: PayslipProps) => (
    <ReactPDF.Document>
      <ReactPDF.Page
        size="A4"
        style={{
          padding: 40,
          fontFamily: "Helvetica",
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        <ReactPDF.Text
          style={{
            fontSize: 20,
            marginBottom: 4,
            fontWeight: "bold",
            color: "#1a1a1a",
          }}
        >
          Payslip
        </ReactPDF.Text>
        <ReactPDF.Text
          style={{
            fontSize: 10,
            color: "#666",
            marginBottom: 24,
            borderBottom: 1,
            borderBottomColor: "#ddd",
            paddingBottom: 12,
          }}
        >
          Payment record for contractor services
        </ReactPDF.Text>

        <ReactPDF.View
          style={{
            marginBottom: 24,
            padding: 16,
            border: 1,
            borderColor: "#e5e5e5",
            borderRadius: 4,
          }}
        >
          <ReactPDF.Text
            style={{ fontSize: 10, color: "#999", marginBottom: 4 }}
          >
            PAYER
          </ReactPDF.Text>
          <ReactPDF.Text style={{ fontSize: 12, marginBottom: 2 }}>
            {businessName}
          </ReactPDF.Text>
          <ReactPDF.Text style={{ fontSize: 10, color: "#666" }}>
            {businessAddress}
          </ReactPDF.Text>
        </ReactPDF.View>

        <ReactPDF.View
          style={{
            marginBottom: 24,
            padding: 16,
            border: 1,
            borderColor: "#e5e5e5",
            borderRadius: 4,
          }}
        >
          <ReactPDF.Text
            style={{ fontSize: 10, color: "#999", marginBottom: 4 }}
          >
            CONTRACTOR
          </ReactPDF.Text>
          <ReactPDF.Text style={{ fontSize: 12, marginBottom: 2 }}>
            {contractorName}
          </ReactPDF.Text>
          <ReactPDF.Text style={{ fontSize: 10, color: "#666" }}>
            {contractorEmail}
          </ReactPDF.Text>
          {contractorTaxId && (
            <ReactPDF.Text style={{ fontSize: 10, color: "#666" }}>
              Tax ID: {contractorTaxId}
            </ReactPDF.Text>
          )}
        </ReactPDF.View>

        <ReactPDF.View
          style={{
            marginBottom: 24,
            padding: 16,
            border: 1,
            borderColor: "#e5e5e5",
            borderRadius: 4,
            backgroundColor: "#fafafa",
          }}
        >
          <ReactPDF.Text
            style={{ fontSize: 10, color: "#999", marginBottom: 4 }}
          >
            PAYMENT DETAILS
          </ReactPDF.Text>
          <ReactPDF.View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <ReactPDF.Text style={{ fontSize: 11, color: "#666" }}>
              Amount
            </ReactPDF.Text>
            <ReactPDF.Text
              style={{ fontSize: 14, fontWeight: "bold", color: "#1a1a1a" }}
            >
              {formatCurrency(amount, currency)}
            </ReactPDF.Text>
          </ReactPDF.View>
          <ReactPDF.View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <ReactPDF.Text style={{ fontSize: 11, color: "#666" }}>
              Payment date
            </ReactPDF.Text>
            <ReactPDF.Text style={{ fontSize: 11, color: "#1a1a1a" }}>
              {paymentDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </ReactPDF.Text>
          </ReactPDF.View>
          <ReactPDF.View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <ReactPDF.Text style={{ fontSize: 11, color: "#666" }}>
              Description
            </ReactPDF.Text>
            <ReactPDF.Text
              style={{
                fontSize: 11,
                color: "#1a1a1a",
                maxWidth: 250,
                textAlign: "right",
              }}
            >
              {description}
            </ReactPDF.Text>
          </ReactPDF.View>
        </ReactPDF.View>

        <ReactPDF.Text
          style={{
            marginTop: 32,
            fontSize: 9,
            color: "#999",
            textAlign: "center",
            padding: 12,
            borderTop: 1,
            borderTopColor: "#eee",
          }}
        >
          This is a record of contractor payment. No tax has been withheld.
        </ReactPDF.Text>
      </ReactPDF.Page>
    </ReactPDF.Document>
  );

  const stream = await ReactPDF.renderToStream(
    <PayslipDocument {...props} />,
  );
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk as Buffer);
    }
  }
  return Buffer.concat(chunks);
}
