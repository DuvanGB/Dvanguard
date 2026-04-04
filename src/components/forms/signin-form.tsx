"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);

  const emailIsValid = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);

  function getSafeNext() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") ? next : "/dashboard";
  }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailIsValid || password.length < 6) {
      setMessage("Ingresa un correo válido y una contraseña de al menos 6 caracteres.");
      setMessageType("error");
      return;
    }
    setLoading(true);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
      setMessageType("error");
    } else {
      window.location.href = getSafeNext();
      return;
    }
    setLoading(false);
  }

  async function handleOAuth(provider: "google" | "apple") {
    const supabase = getSupabaseBrowserClient();
    const safeNext = getSafeNext();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` }
    });
  }

  return (
    <main className="auth-shell">
      <div className="auth-container">
        <div className="auth-header stack">
          <h1>Iniciar sesión</h1>
          <p>Accede a tu cuenta para gestionar tus sitios web.</p>
        </div>

        <div className="auth-providers">
          <button type="button" className="auth-oauth-btn" onClick={() => handleOAuth("google")}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuar con Google
          </button>
          <button type="button" className="auth-oauth-btn" onClick={() => handleOAuth("apple")}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.02 8.93 8.75c1.26.06 2.14.7 2.88.75.79-.16 2.01-.89 3.4-.76 1.57.14 2.76.82 3.5 2.1-3.18 1.9-2.43 6.1.62 7.28-.5 1.3-1.15 2.58-2.28 4.16zM12.03 8.67c-.15-2.23 1.66-4.07 3.74-4.25.28 2.53-2.31 4.4-3.74 4.25z" />
            </svg>
            Continuar con Apple
          </button>
        </div>

        <div className="auth-divider"><span>o con tu cuenta</span></div>

        <form className="stack" onSubmit={handlePasswordLogin}>
          <label>
            Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        {message ? (
          <p className={messageType === "success" ? "auth-msg auth-msg-ok" : "auth-msg auth-msg-err"}>{message}</p>
        ) : null}

        <p className="auth-footer">
          ¿No tienes cuenta? <Link href="/signup">Crear cuenta</Link>
        </p>
      </div>
    </main>
  );
}
