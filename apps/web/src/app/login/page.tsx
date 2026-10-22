import { redirect } from "next/navigation";
import { Hand } from "lucide-react";
import { LoginForm } from "@/features/auth/presentation/LoginForm";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams: Promise<{ setup?: string; redirectTo?: string; access?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();

  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) {
      const { data: staffAccess } = await supabase
        .from("staff_access")
        .select("user_id")
        .eq("user_id", data.claims.sub)
        .eq("is_active", true)
        .maybeSingle();
      if (staffAccess) redirect("/atender");
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand-mark" aria-hidden="true"><Hand size={29} strokeWidth={2.2} /></div>
        <p className="eyebrow">Acceso para personal autorizado</p>
        <h1 id="login-title">La Voz de tus Manos</h1>
        <p className="login-intro">Inicia sesión para registrar y consultar atenciones.</p>

        {!configured || params.setup === "missing" ? (
          <div className="auth-message auth-message--error" role="alert">
            Configura <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> en <code>apps/web/.env.local</code>.
          </div>
        ) : (
          <>
            {params.access === "pending" ? (
              <p className="auth-message auth-message--error" role="alert">
                La cuenta inició sesión, pero aún no está autorizada para usar el sistema. Solicita al administrador que habilite tu acceso.
              </p>
            ) : null}
            <LoginForm redirectTo={params.redirectTo} accessPending={params.access === "pending"} />
          </>
        )}

        <p className="login-footnote">Las cuentas de personal se habilitan desde Supabase Auth; no hay registro público en esta aplicación.</p>
      </section>
    </main>
  );
}
