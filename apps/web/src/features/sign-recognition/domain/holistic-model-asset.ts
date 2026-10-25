export interface HolisticModelAsset {
  url: string;
  pin: { version: string; sha256: string; bytes: number } | null;
}

export interface HolisticAssetDiagnostics {
  integrity: "verified" | "unverified";
  source: "fetch" | "cache-storage";
  version?: string;
  sha256?: string;
  bytes: number;
  readMs: number;
  integrityMs: number;
}
