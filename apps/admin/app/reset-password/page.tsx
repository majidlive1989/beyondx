import { Suspense } from "react";
import { ResetPasswordClient } from "./reset-password-client";

export default function ResetPasswordPage() {
  return <main className="centered"><Suspense fallback={<section className="result-card">Loading…</section>}><ResetPasswordClient /></Suspense></main>;
}
