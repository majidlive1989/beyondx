"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAuth } from "@/components/auth-provider";
import { updateProfile } from "@/lib/api";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [message, setMessage] = useState("");
  useEffect(() => { if (user) { setFirstName(user.firstName); setLastName(user.lastName); } }, [user]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const updated = await updateProfile({ firstName, lastName });
    setUser(updated); setMessage("Profile updated successfully.");
  }
  return <AdminShell><header className="page-header"><div><span className="eyebrow">Personal settings</span><h1>Your profile</h1><p>Update your administrator identity.</p></div></header><section className="panel form-panel"><form onSubmit={(event) => void submit(event)}><div className="form-grid"><label>First name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label><label>Last name<input value={lastName} onChange={(event) => setLastName(event.target.value)} required /></label><label className="full">Email<input value={user?.email ?? ""} disabled /></label></div>{message ? <div className="success-banner">{message}</div> : null}<button className="primary-button">Save profile</button></form></section></AdminShell>;
}
