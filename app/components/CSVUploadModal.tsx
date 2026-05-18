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
  "clientname": "clientName",
  "client email": "clientEmail",
  "clientemail": "clientEmail",
  "amount": "amount",
  "due date": "dueDate",
  "duedate": "dueDate",
  "notes": "notes",
  "invoice number": "invoiceNumber",
  "invoicenumber": "invoiceNumber",
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

function parseCSVFile(file: File): Promise<{ rows: ParsedRow[]; errors: string[] }> {
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
        const requiredFields = ["clientName", "clientEmail", "amount", "dueDate"];
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
          if (parsed.clientName && parsed.clientEmail && parsed.amount && parsed.dueDate) {
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

export default function CSVUploadModal({ open, onClose, onUploadComplete }: CSVUploadModalProps) {
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
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFile(selectedFile);
      }
    },
    [handleFile]
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
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Upload CSV</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4">
          {uploadResult ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/30">
                <p className="font-medium text-green-800 dark:text-green-300">
                  {uploadResult.created} invoice(s) created successfully
                </p>
              </div>

              {uploadResult.errors.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-red-700 dark:text-red-400">
                    {uploadResult.errors.length} row(s) had errors:
                  </h3>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                    {uploadResult.errors.map((err, i) => (
                      <p key={i} className="text-sm text-red-700 dark:text-red-300">
                        Row {err.row}: {err.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
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
                      ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                      : "border-slate-300 hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500"
                  }`}
                >
                  <svg
                    className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500"
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
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Drop your CSV file here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Expected columns: Client Name, Client Email, Amount, Due Date (YYYY-MM-DD), Notes (optional)
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
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-700/50">
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {parsedRows.length} rows ready to import
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetState}
                      className="text-xs text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      Change file
                    </button>
                  </div>

                  {parseErrors.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                      {parseErrors.map((err, i) => (
                        <p key={i} className="text-sm text-amber-700 dark:text-amber-300">
                          {err}
                        </p>
                      ))}
                    </div>
                  )}

                  {parsedRows.length > 0 && (
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700/80">
                          <tr>
                            <th className="px-3 py-2 font-medium text-slate-600 dark:text-slate-300">#</th>
                            <th className="px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Client</th>
                            <th className="px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Email</th>
                            <th className="px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Amount</th>
                            <th className="px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Due Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {parsedRows.slice(0, 20).map((row, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-slate-400 dark:text-slate-500">{i + 1}</td>
                              <td className="px-3 py-2 text-slate-900 dark:text-white">{row.clientName}</td>
                              <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.clientEmail}</td>
                              <td className="px-3 py-2 text-slate-900 dark:text-white">{row.amount}</td>
                              <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.dueDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsedRows.length > 20 && (
                        <p className="border-t border-slate-200 px-3 py-2 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          Showing 20 of {parsedRows.length} rows
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={resetState}
                      className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={uploading || parsedRows.length === 0}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                    >
                      {uploading ? "Uploading..." : `Import ${parsedRows.length} Invoice(s)`}
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
