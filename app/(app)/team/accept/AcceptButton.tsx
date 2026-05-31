"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptButton({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  async function handleAccept() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/team/accept?token=${token}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Failed to accept invitation");
        return;
      }
      setStatus("success");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="text-center">
        <div className="bg-success/10 border border-success/20 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-success">
            Invitation accepted! Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      {status === "error" && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 mb-4">
          <p className="text-sm text-danger">{errorMsg}</p>
        </div>
      )}
      <button
        onClick={handleAccept}
        disabled={status === "loading"}
        className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "loading" ? "Accepting..." : "Accept Invitation"}
      </button>
    </div>
  );
}
