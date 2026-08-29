const WORD_POOL = [
  "ant", "bat", "bee", "bug", "cat", "cow", "dog", "elk", "emu", "fox",
  "hen", "jay", "koi", "owl", "pig", "ram", "rat", "yak", "ape", "cod",
  "cup", "dot", "ear", "egg", "fan", "gem", "hat", "ice", "jam", "key",
  "lip", "map", "net", "oak", "pan", "red", "sky", "sun", "tea", "urn",
  "van", "web", "zip", "ace", "bay", "den", "fin", "fog", "gum", "hop",
  "ink", "jet", "kit", "log", "mud", "nap", "oat", "pea", "rig", "sap",
  "tag", "vet", "wax", "axe", "bow", "cap", "dew", "elm", "fig", "gap",
  "hub", "ivy", "jug", "lab", "mix", "nub", "orb", "pod", "rag", "sob",
  "tin", "vow", "wig", "yew", "ark", "bin", "cob", "dip", "fir", "gym",
  "hum", "ion", "jar", "lap", "mop", "nil", "ore", "pit", "rye", "spa",
];

const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I, L, O (avoid confusion with 1, l, 0)

export function generateRoomCode(existingCodes: Set<string>): string {
  const maxAttempts = 100;
  for (let i = 0; i < maxAttempts; i++) {
    const word = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
    const digit = Math.floor(Math.random() * 10);
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const code = `${word}-${digit}${letter}`;
    if (!existingCodes.has(code)) return code;
  }
  throw new Error("Failed to generate unique room code");
}

export { WORD_POOL };
