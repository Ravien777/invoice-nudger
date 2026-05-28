"use client";

import { useState } from "react";

export default function SignContractClient({
  contractId,
  token,
  title,
  clientName,
}: {
  contractId: string;
  token: string;
  title: string;
  clientName: string;
}) {
  const [agreed, setAgreed] = useState(false);
  const [signedByName, setSignedByName] = useState("");
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSign = async () => {
    if (!agreed || !signedByName.trim()) return;
    setSigning(true);
    setError("");

    try {
      const res = await fetch(`/api/contracts/${contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signedByName: signedByName.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to sign contract");
        return;
      }

      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-3xl mx-auto mt-6 bg-white rounded-xl shadow-sm border p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Signed successfully ✓</h2>
        <p className="text-gray-500">
          Thank you, {signedByName}. &ldquo;{title}&rdquo; has been signed.
        </p>
        <p className="text-gray-400 text-sm mt-2">
          A confirmation email has been sent to both parties.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-6 bg-white rounded-xl shadow-sm border p-6 md:p-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Sign this contract</h2>

      <label className="flex items-start gap-3 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 rounded border-gray-300"
        />
        <span className="text-sm text-gray-700">
          I have read and agree to the terms above.
        </span>
      </label>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type your full legal name to sign
        </label>
        <input
          type="text"
          value={signedByName}
          onChange={(e) => setSignedByName(e.target.value)}
          placeholder="e.g. John Doe"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      <button
        onClick={handleSign}
        disabled={!agreed || !signedByName.trim() || signing}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {signing ? "Signing..." : "Sign Contract"}
      </button>
    </div>
  );
}
