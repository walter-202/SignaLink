import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabasePublicConfig, isSupabaseConfigured } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase public configuration", () => {
  it("reports missing credentials without breaking the demo app", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getSupabasePublicConfig()).toThrow("Supabase no está configurado");
  });

  it("requires both public values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns a valid URL and publishable key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " https://project.supabase.co ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", " sb_publishable_test ");

    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabasePublicConfig()).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it("rejects a malformed URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

    expect(() => getSupabasePublicConfig()).toThrow("debe ser una URL válida");
  });
});
