import { describe, it, expect } from "vitest";
import { generateRoomCode, WORD_POOL } from "@/lib/roomCode";

describe("generateRoomCode", () => {
  it("returns a code matching the pattern word-digitLetter", () => {
    const code = generateRoomCode(new Set());
    expect(code).toMatch(/^[a-z]+-\d[A-Z]$/);
  });

  it("uses a word from the pool", () => {
    const code = generateRoomCode(new Set());
    const word = code.split("-")[0];
    expect(WORD_POOL).toContain(word);
  });

  it("does not return an existing code", () => {
    const existing = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode(existing);
      expect(existing.has(code)).toBe(false);
      existing.add(code);
    }
  });

  it("throws if it cannot generate a unique code", () => {
    const allCodes = new Set<string>();
    for (const w of WORD_POOL) {
      for (let d = 0; d < 10; d++) {
        for (const l of "ABCDEFGHJKMNPQRSTUVWXYZ") {
          allCodes.add(`${w}-${d}${l}`);
        }
      }
    }
    expect(() => generateRoomCode(allCodes)).toThrow("Failed to generate unique room code");
  });
});
