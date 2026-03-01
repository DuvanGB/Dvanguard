"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`
      }
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Revisa tu correo para iniciar sesión.");
    }

    setLoading(false);
  }

  return (
    <main className="container stack" style={{ maxWidth: "500px", paddingTop: "3rem" }}>
      <h1>Iniciar sesión</h1>
      <p>Usa magic link de Supabase para acceder al dashboard.</p>
      <form className="stack" onSubmit={handleSignIn}>
        <label>
          Correo
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
