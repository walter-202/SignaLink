"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface LoginFormProps {
  redirectTo?: string;
}

function safeRedirectPath(value: string | undefined): string {
  if (value === "/historial" || value?.startsWith("/historial/")) return value;
  if (value === "/atender" || value?.startsWith("/atender/")) return value;
  return "/atender";
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("No se pudo iniciar sesión. Revisa el correo, la contraseña y que la cuenta esté habilitada.");
        setIsSubmitting(false);
        return;
      }

      router.replace(safeRedirectPath(redirectTo));
      router.refresh();
    } catch {
      setError("No se pudo iniciar sesión. Revisa el correo, la contraseña y que la cuenta esté habilitada.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label htmlFor="staff-email">Correo electrónico</label>
      <input
        id="staff-email"
        name="email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.currentTarget.value)}
        required
      />
      <label htmlFor="staff-password">Contraseña</label>
      <input
        id="staff-password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
        required
      />
      {error ? <p className="auth-message auth-message--error" role="alert">{error}</p> : null}
      <button className="login-submit" type="submit" disabled={isSubmitting}>
        <LogIn size={17} aria-hidden="true" />
        {isSubmitting ? "Ingresando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
