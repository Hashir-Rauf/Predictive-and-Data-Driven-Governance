import type { Role } from "@gov-dashboard/shared-types";

export interface JwtClaims {
  sub: string;
  role: Role;
  regionId: number | null;
  agencyId: number | null;
  iat: number;
  exp: number;
}

function base64UrlEncode(data: ArrayBuffer | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** Minimal HS256 JWT sign/verify over Web Crypto — no Node dependency, works unmodified on Workers. */
export async function signJwt(
  claims: Omit<JwtClaims, "iat" | "exp">,
  secret: string,
  ttlSeconds: number
): Promise<string> {
  const key = await importHmacKey(secret);
  const now = Math.floor(Date.now() / 1000);
  const fullClaims: JwtClaims = { ...claims, iat: now, exp: now + ttlSeconds };

  const headerB64 = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullClaims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const key = await importHmacKey(secret);
  const signingInput = `${headerB64}.${payloadB64}`;
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(sigB64),
    new TextEncoder().encode(signingInput)
  );
  if (!valid) return null;

  let claims: JwtClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as JwtClaims;
  } catch {
    return null;
  }
  if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
}
