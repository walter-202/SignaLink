import { describe, expect, it } from "vitest";
import { appendRecognizedLabel, isCharacterLabel } from "./sign-transcript";

describe("appendRecognizedLabel", () => {
  it("starts a transcript without leading spaces", () => {
    expect(appendRecognizedLabel("", "HOLA", false)).toBe("HOLA");
    expect(appendRecognizedLabel("", " ", false)).toBe("");
  });

  it("joins fingerspelled characters and separates words", () => {
    let transcript = appendRecognizedLabel("", "HOLA", false);
    transcript = appendRecognizedLabel(transcript, "M", false);
    transcript = appendRecognizedLabel(transcript, "U", true);
    transcript = appendRecognizedLabel(transcript, "N", true);
    transcript = appendRecognizedLabel(transcript, "DO", true);

    expect(transcript).toBe("HOLA MUN DO");
  });

  it("keeps fingerspelling together even when it matches a word label", () => {
    let transcript = appendRecognizedLabel("", "MI", false);
    transcript = appendRecognizedLabel(transcript, "S", true);

    expect(transcript).toBe("MIS");
    expect(appendRecognizedLabel("MI", "S", false)).toBe("MI S");
  });

  it("uses the model space label without duplicating spaces", () => {
    expect(appendRecognizedLabel("HOLA", " ", true)).toBe("HOLA ");
    expect(appendRecognizedLabel("HOLA ", " ", false)).toBe("HOLA ");
    expect(appendRecognizedLabel("HOLA ", "YO", false)).toBe("HOLA YO");
  });

  it("keeps multiword labels intact", () => {
    expect(appendRecognizedLabel("HOLA", "BUENOS DIAS", false)).toBe("HOLA BUENOS DIAS");
  });

  it("joins the LL digraph with fingerspelled characters", () => {
    const transcript = appendRecognizedLabel(appendRecognizedLabel("M", "U", true), "LL", true);

    expect(transcript).toBe("MULL");
  });

  it("classifies character, digraph and word labels", () => {
    expect(isCharacterLabel("A")).toBe(true);
    expect(isCharacterLabel("Ñ")).toBe(true);
    expect(isCharacterLabel("7")).toBe(true);
    expect(isCharacterLabel("LL")).toBe(true);
    expect(isCharacterLabel("HOLA")).toBe(false);
    expect(isCharacterLabel("10")).toBe(false);
    expect(isCharacterLabel(" ")).toBe(false);
  });
});
