"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@beyondx.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try { await login(email, password); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Unable to sign in"); }
    finally { setSubmitting(false); }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand auth-brand"><span className="brand-mark">BX</span><div><strong>BeyondX</strong><small>Build Any Digital Product</small></div></div>
        <div className="auth-copy"><span className="eyebrow">Phase 1 · Identity</span><h1>Control the platform from one secure workspace.</h1><p>Sign in with the seeded administrator account to manage users, roles, permissions and sessions.</p></div>
      </section>
      <section className="login-card">
        <form onSubmit={(event) => void submit(event)}>
          <span className="eyebrow">Administrator access</span><h2>Welcome back</h2><p>Use your BeyondX administrator credentials.</p>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required /></label>
          {error ? <div className="error-banner">{error}</div> : null}
          <button className="primary-button" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}
