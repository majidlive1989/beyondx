"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";

export function ResetPasswordClient() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await resetPassword(token, password); setMessage("Password reset. You can sign in now."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Reset failed."); }
  }
  return <section className="result-card"><span className="brand-mark">BX</span><h1>Reset password</h1><form onSubmit={(event) => void submit(event)}><label>New password<input type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="primary-button">Reset password</button></form>{message ? <p>{message}</p> : null}<a href="/login">Back to login</a></section>;
}
