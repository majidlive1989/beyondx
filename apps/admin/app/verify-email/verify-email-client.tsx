"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyEmail } from "@/lib/api";

export function VerifyEmailClient() {
  const params = useSearchParams();
  const [message, setMessage] = useState("Verifying your email…");
  useEffect(() => {
    const token = params.get("token");
    if (!token) { setMessage("Verification token is missing."); return; }
    void verifyEmail(token)
      .then(() => setMessage("Email verified. You can sign in now."))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Verification failed."));
  }, [params]);
  return <section className="result-card"><span className="brand-mark">BX</span><h1>Email verification</h1><p>{message}</p><a href="/login" className="primary-button">Go to login</a></section>;
}
