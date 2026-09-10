import crypto from "crypto";

// נרמול תשובה: רווחים מיותרים + אותיות קטנות, כדי ש-"רקס" == " רקס " == "רקס".
function normalize(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}

// הצפנה חד-כיוונית עם salt לכל משתמש. פורמט: scrypt$<saltHex>$<hashHex>.
export function hashAnswer(answer: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(normalize(answer), salt, 32);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyAnswer(answer: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  try {
    const [scheme, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(normalize(answer), salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
