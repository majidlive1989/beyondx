import { Suspense } from "react";
import { VerifyEmailClient } from "./verify-email-client";

export default function VerifyEmailPage() {
  return <main className="centered"><Suspense fallback={<section className="result-card">Verifying…</section>}><VerifyEmailClient /></Suspense></main>;
}
