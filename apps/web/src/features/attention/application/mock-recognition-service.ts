export interface RecognitionRequest {
  simulateError?: boolean;
  latencyMs?: number;
  onProcessing?: () => void;
}

export async function recognizeMockSign({
  simulateError = false,
  latencyMs = process.env.NODE_ENV === "test" ? 0 : 720,
  onProcessing,
}: RecognitionRequest = {}): Promise<string> {
  if (latencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(180, latencyMs)));
    onProcessing?.();
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, latencyMs - 180)));
  } else {
    onProcessing?.();
  }
  if (simulateError) throw new Error("No se pudo preparar una interpretación de demostración.");
  return "Quiero información sobre mi registro.";
}
