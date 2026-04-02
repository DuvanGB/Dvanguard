"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);

  const emailIsValid = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);
  const passwordsMatch = password === confirmPassword;

  async function handleOAuth(provider: "google" | "apple") {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` }
    });
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!emailIsValid) {
      setMessage("Ingresa un correo electrónico válido.");
      setMessageType("error");
      return;
    }
    if (password.length < 6) {
      setMessage("La contraseña debe tener al menos 6 caracteres.");
      setMessageType("error");
      return;
    }
    if (!passwordsMatch) {
      setMessage("Las contraseñas no coinciden.");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`
      }
    });

    if (error) {
      setMessage(error.message);
      setMessageType("error");
    } else {
      window.location.href = "/onboarding";
      return;
    }
    setLoading(false);
  }

  return (
    <main className="auth-shell">
      <div className="auth-container">
        <div className="auth-header stack">
          <h1>Crear cuenta</h1>
          <p>Regístrate para crear y publicar tus sitios web con IA.</p>
        </div>

        <div className="auth-providers">
          <button type="button" className="auth-oauth-btn" onClick={() => handleOAuth("google")}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Registrarse con Google
          </button>
          <button type="button" className="auth-oauth-btn" onClick={() => handleOAuth("apple")}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.02 8.93 8.75c1.26.06 2.14.7 2.88.75.79-.16 2.01-.89 3.4-.76 1.57.14 2.76.82 3.5 2.1-3.18 1.9-2.43 6.1.62 7.28-.5 1.3-1.15 2.58-2.28 4.16zM12.03 8.67c-.15-2.23 1.66-4.07 3.74-4.25.28 2.53-2.31 4.4-3.74 4.25z" />
            </svg>
            Registrarse con Apple
          </button>
        </div>

        <div className="auth-divider"><span>o con email</span></div>

        <form className="stack" onSubmit={handleSignUp}>
          <label>
            Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required />
          </label>
          <label>
            Confirmar contraseña
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repite tu contraseña" minLength={6} required />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        {message ? (
          <p className={messageType === "success" ? "auth-msg auth-msg-ok" : "auth-msg auth-msg-err"}>{message}</p>
        ) : null}

        <p className="auth-footer">
          ¿Ya tienes cuenta? <Link href="/signin">Iniciar sesión</Link>
        </p>
      </div>
    </main>
  );
}
