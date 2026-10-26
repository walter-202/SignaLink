import type { Metadata } from "next";
import AvatarExperience from "@/features/avatar/AvatarExperience";

export const metadata: Metadata = {
  title: "Laboratorio de avatar 3D | La Voz de tus Manos",
  robots: { index: false, follow: false },
};

/** Public, non-authenticated QA viewer. It exposes no user or session data. */
export default function AvatarLabPage() {
  return <AvatarExperience />;
}
