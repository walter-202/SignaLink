import { describe, expect, it } from "vitest";
import { procedureNotesSchema, replyTextSchema } from "./validation";

describe("attention input validation", () => {
  it("trims valid responses and rejects empty or overlong text", () => {
    expect(replyTextSchema.parse("  De acuerdo.  ")).toBe("De acuerdo.");
    expect(replyTextSchema.safeParse("   ").success).toBe(false);
    expect(replyTextSchema.safeParse("a".repeat(501)).success).toBe(false);
  });

  it("allows up to 300 characters in internal notes", () => {
    expect(procedureNotesSchema.safeParse("a".repeat(300)).success).toBe(true);
    expect(procedureNotesSchema.safeParse("a".repeat(301)).success).toBe(false);
  });
});
