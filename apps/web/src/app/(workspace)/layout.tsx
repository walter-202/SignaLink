import type { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";
import { CameraProvider } from "@/features/camera";
import { SpeechRecognitionProvider } from "@/features/communication";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <SpeechRecognitionProvider>
      <CameraProvider>
        <AppShell>{children}</AppShell>
      </CameraProvider>
    </SpeechRecognitionProvider>
  );
}
