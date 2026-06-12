import { NextResponse } from "next/server";

export function validateApiKey(request: Request): NextResponse | null {
  const apiKey = request.headers.get("X-API-Key");
  const expected = process.env.MARONI_API_KEY;

  if (!apiKey || !expected || apiKey !== expected) {
    return NextResponse.json(
      { error: "Missing or invalid API key" },
      { status: 401 }
    );
  }

  return null;
}
