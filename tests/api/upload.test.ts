import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { mockSession, mockUser } from "../helpers";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/upload/route";

vi.mock("@/lib/storage");

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  const storage = await import("@/lib/storage");
  vi.mocked(storage.validateReceiptFile).mockReturnValue(null);
  vi.mocked(storage.uploadReceipt).mockResolvedValue("https://blob.vercel.test/receipt.jpg");
});

async function createUploadRequest(file: File | null) {
  const formData = new FormData();
  if (file) formData.append("receipt", file);
  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/upload", () => {
  it("returns 401 without session", async () => {
    const req = await createUploadRequest(null);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 with no file", async () => {
    mockSession();
    mockUser();
    const req = await createUploadRequest(null);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No file provided");
  });

  it("returns 400 with invalid file type", async () => {
    const storage = await import("@/lib/storage");
    vi.mocked(storage.validateReceiptFile).mockReturnValue("Only JPEG, PNG, WebP, and PDF files are allowed");
    mockSession();
    mockUser();
    const req = await createUploadRequest(new File([], "test.txt", { type: "text/plain" }));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with valid file", async () => {
    mockSession();
    mockUser();
    const req = await createUploadRequest(new File(["fake"], "receipt.jpg", { type: "image/jpeg" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://blob.vercel.test/receipt.jpg");
  });

  it("returns 400 with oversized file", async () => {
    const storage = await import("@/lib/storage");
    vi.mocked(storage.validateReceiptFile).mockReturnValue("File size must be under 10 MB");
    mockSession();
    mockUser();
    const req = await createUploadRequest(new File(["x"], "big.pdf", { type: "application/pdf" }));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
