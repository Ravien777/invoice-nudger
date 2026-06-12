"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import toast from "react-hot-toast";

interface ParsedRow {
  clientName: string;
  clientEmail: string;
  amount: string | number;
  dueDate: string;
  invoiceNumber?: string;
  notes?: string;
  currency?: string;
}

interface UploadResult {
  created: number;
  errors: { row: number; reason: string }[];
}

const COLUMN_MAP: Record<string, keyof ParsedRow> = {
  "client name": "clientName",
  clientname: "clientName",
  "client email": "clientEmail",
  clientemail: "clientEmail",
  amount: "amount",
  "due date": "dueDate",
  duedate: "dueDate",
  notes: "notes",
  "invoice number": "invoiceNumber",
  invoicenumber: "invoiceNumber",
};

function normalizeHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const header of headers) {
    const normalized = header.trim().toLowerCase().replace(/_/g, " ");
    const key = normalized.replace(/\s/g, "");
    const mapped = COLUMN_MAP[key] || COLUMN_MAP[normalized];
    if (mapped) {
      map[header] = mapped;
    }
  }
  return map;
}

function parseCSVFile(
  file: File,
): Promise<{ rows: ParsedRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    const errors: string[] = [];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          for (const err of results.errors.slice(0, 5)) {
            errors.push(`Row ${err.row}: ${err.message}`);
          }
        }

        if (!results.meta.fields || results.meta.fields.length === 0) {
          resolve({ rows: [], errors: ["CSV file has no headers"] });
          return;
        }

        const headerMap = normalizeHeaders(results.meta.fields);
        const requiredFields = [
          "clientName",
          "clientEmail",
          "amount",
          "dueDate",
        ];
        const foundFields = new Set(Object.values(headerMap));

        for (const field of requiredFields) {
          if (!foundFields.has(field)) {
            resolve({
              rows: [],
              errors: [
                `Missing required column. Expected one of: ${field === "clientName" ? '"Client Name"' : field === "clientEmail" ? '"Client Email"' : field === "amount" ? '"Amount"' : '"Due Date"'}`,
              ],
            });
            return;
          }
        }

        const rows: ParsedRow[] = [];
        for (const row of results.data as Record<string, string>[]) {
          const parsed: Partial<ParsedRow> = {};
          for (const [originalHeader, mappedKey] of Object.entries(headerMap)) {
            const value = row[originalHeader]?.trim();
            if (value) {
              (parsed as Record<string, string>)[mappedKey] = value;
            }
          }
          if (
            parsed.clientName &&
            parsed.clientEmail &&
            parsed.amount &&
            parsed.dueDate
          ) {
            rows.push(parsed as ParsedRow);
          }
        }

        resolve({ rows, errors });
      },
    });
  });
}

interface CSVUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export default function CSVUploadModal({
  open,
  onClose,
  onUploadComplete,
}: CSVUploadModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setParseErrors([]);
    setUploading(false);
    setUploadResult(null);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a .csv file");
      return;
    }

    setFile(file);
    setUploadResult(null);

    const { rows, errors } = await parseCSVFile(file);
    setParsedRows(rows);
    setParseErrors(errors);

    if (errors.length > 0 && rows.length === 0) {
      toast.error(errors[0]);
    } else if (rows.length > 0) {
      toast.success(`Parsed ${rows.length} rows from CSV`);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFile(selectedFile);
      }
    },
    [handleFile],
  );

  const handleUpload = async () => {
    if (parsedRows.length === 0) return;

    setUploading(true);

    try {
      const res = await fetch("/api/invoices/upload-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Upload failed");
        return;
      }

      setUploadResult({ created: data.created, errors: data.errors });

      if (data.created > 0) {
        toast.success(`${data.created} invoice(s) created`);
      }

      if (data.errors?.length > 0) {
        toast.error(`${data.errors.length} row(s) had errors`);
      }

      onUploadComplete?.();
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Upload CSV</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-muted hover:text-foreground"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4">
          {uploadResult ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-surface-muted p-4">
                <p className="font-medium text-foreground">
                  {uploadResult.created} invoice(s) created successfully
                </p>
              </div>

              {uploadResult.errors.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-foreground">
                    {uploadResult.errors.length} row(s) had errors:
                  </h3>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-muted p-3">
                    {uploadResult.errors.map((err, i) => (
                      <p key={i} className="text-sm text-foreground">
                        Row {err.row}: {err.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:brightness-110"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!file ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition ${
                    isDragging
                      ? "border-accent bg-surface-muted"
                      : "border-border hover:border-foreground"
                  }`}
                >
                  <svg
                    className="mb-3 h-10 w-10 text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3"
                    />
                  </svg>
                  <p className="text-sm font-medium text-foreground">
                    Drop your CSV file here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Expected columns: Client Name, Client Email, Amount, Due
                    Date (YYYY-MM-DD), Notes (optional)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-surface-muted px-4 py-3">
                    <div className="flex items-center gap-3">
                      <svg
                        className="h-5 w-5 text-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted">
                          {parsedRows.length} rows ready to import
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetState}
                      className="text-xs text-accent transition hover:text-foreground"
                    >
                      Change file
                    </button>
                  </div>

                  {parseErrors.length > 0 && (
                    <div className="rounded-lg border border-border bg-surface-muted p-3">
                      {parseErrors.map((err, i) => (
                        <p key={i} className="text-sm text-foreground">
                          {err}
                        </p>
                      ))}
                    </div>
                  )}

                  {parsedRows.length > 0 && (
                    <div className="max-h-64 overflow-x-auto overflow-y-auto rounded-lg border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-surface-muted">
                          <tr>
                            <th className="px-3 py-2 font-medium text-muted">
                              #
                            </th>
                            <th className="px-3 py-2 font-medium text-muted">
                              Client
                            </th>
                            <th className="px-3 py-2 font-medium text-muted">
                              Email
                            </th>
                            <th className="px-3 py-2 font-medium text-muted">
                              Amount
                            </th>
                            <th className="px-3 py-2 font-medium text-muted">
                              Due Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {parsedRows.slice(0, 20).map((row, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-muted">{i + 1}</td>
                              <td className="px-3 py-2 text-foreground">
                                {row.clientName}
                              </td>
                              <td className="px-3 py-2 text-muted">
                                {row.clientEmail}
                              </td>
                              <td className="px-3 py-2 text-foreground">
                                {row.amount}
                              </td>
                              <td className="px-3 py-2 text-muted">
                                {row.dueDate}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsedRows.length > 20 && (
                        <p className="border-t border-border px-3 py-2 text-center text-xs text-muted">
                          Showing 20 of {parsedRows.length} rows
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={resetState}
                      className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={uploading || parsedRows.length === 0}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:brightness-110 disabled:opacity-50"
                    >
                      {uploading
                        ? "Uploading..."
                        : `Import ${parsedRows.length} Invoice(s)`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
