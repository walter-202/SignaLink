import type { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";
import { CameraProvider } from "@/features/camera";
import { SpeechRecognitionProvider } from "@/features/communication";
import { SignRecognitionProvider } from "@/features/sign-recognition";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <SpeechRecognitionProvider>
      <SignRecognitionProvider>
        <CameraProvider>
          <AppShell>{children}</AppShell>
        </CameraProvider>
      </SignRecognitionProvider>
    </SpeechRecognitionProvider>
  );
}
