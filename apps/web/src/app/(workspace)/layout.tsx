import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { CameraProvider } from "@/features/camera";
import { SpeechRecognitionProvider } from "@/features/communication";
import { SignRecognitionProvider } from "@/features/sign-recognition";
import { AttentionDataBootstrap } from "@/features/attention/presentation/AttentionDataBootstrap";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/login?setup=missing");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  const { data: staffAccess, error: staffAccessError } = await supabase
    .from("staff_access")
    .select("user_id")
    .eq("user_id", data.claims.sub)
    .eq("is_active", true)
    .maybeSingle();
  if (staffAccessError || !staffAccess) redirect("/login?access=pending");

  return (
    <SpeechRecognitionProvider>
      <SignRecognitionProvider>
        <CameraProvider>
          <AttentionDataBootstrap>
            <AppShell>{children}</AppShell>
          </AttentionDataBootstrap>
        </CameraProvider>
      </SignRecognitionProvider>
    </SpeechRecognitionProvider>
  );
}
