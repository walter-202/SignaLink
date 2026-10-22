import type { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";
import { SpeechRecognitionProvider } from "@/features/communication";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <SpeechRecognitionProvider>
      <AppShell>{children}</AppShell>
    </SpeechRecognitionProvider>
  );
}
