import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024;

export function validateReceiptFile(file: File): string | null {
  if (file.size > MAX_SIZE) return "File size must be under 10 MB";
  if (!ALLOWED_TYPES.includes(file.type)) return "Only JPEG, PNG, WebP, and PDF files are allowed";
  return null;
}

export async function uploadReceipt(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `receipts/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const blob = await put(path, file, {
    access: "public",
    addRandomSuffix: false,
  });

  return blob.url;
}

export async function uploadPdf(buffer: Buffer, userId: string): Promise<string> {
  const path = `contracts/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;

  const blob = await put(path, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/pdf",
  });

  return blob.url;
}

export async function deleteBlob(url: string): Promise<void> {
  await del(url);
}
