import React from "react";
import ReactPDF from "@react-pdf/renderer";

interface ContractPdfProps {
  title: string;
  body: string;
  signedByName: string;
  signedAt: Date;
  signedByIp: string;
  clientName: string;
}

const PdfDocument = ({ title, body, signedByName, signedAt, signedByIp }: ContractPdfProps) => (
  <ReactPDF.Document>
    <ReactPDF.Page size="A4" style={{ padding: 40, fontFamily: "Helvetica", fontSize: 11, lineHeight: 1.5 }}>
      <ReactPDF.Text style={{ fontSize: 18, marginBottom: 4, fontWeight: "bold" }}>{title}</ReactPDF.Text>
      <ReactPDF.View style={{ fontSize: 10, color: "#666", marginBottom: 16, borderBottom: 1, borderBottomColor: "#ddd", paddingBottom: 8 }}>
        <ReactPDF.Text>Signed by: {signedByName}</ReactPDF.Text>
      </ReactPDF.View>
      <ReactPDF.View style={{ marginBottom: 24 }}>
        <ReactPDF.Text>{stripHtml(body)}</ReactPDF.Text>
      </ReactPDF.View>
      <ReactPDF.View style={{ marginTop: 24, paddingTop: 16, borderTop: 1, borderTopColor: "#ddd", fontSize: 10, color: "#333" }}>
        <ReactPDF.Text>Signed by: {signedByName}</ReactPDF.Text>
        <ReactPDF.Text>Date: {signedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</ReactPDF.Text>
        <ReactPDF.Text>IP: {signedByIp}</ReactPDF.Text>
      </ReactPDF.View>
      <ReactPDF.Text style={{ marginTop: 32, fontSize: 9, color: "#999", textAlign: "center" }}>
        This contract was electronically signed. Valid in most jurisdictions.
      </ReactPDF.Text>
    </ReactPDF.Page>
  </ReactPDF.Document>
);

export async function generateContractPdf(props: ContractPdfProps): Promise<Buffer> {
  const stream = await ReactPDF.renderToStream(<PdfDocument {...props} />);
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

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
