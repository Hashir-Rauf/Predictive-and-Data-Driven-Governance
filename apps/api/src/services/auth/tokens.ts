import { sha256Hex } from "../../lib/hash";

/** Opaque random refresh token — never stored directly, only its hash (see hashToken). */
export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const hashToken = sha256Hex;

export function generateJobId(): string {
  return crypto.randomUUID();
}
