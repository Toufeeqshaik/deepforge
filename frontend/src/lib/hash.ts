/**
 * Compute SHA-256 hash of a File using the Web Crypto API.
 * Returns hex string.
 */
export async function getFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute SHA-256 hash of a string.
 */
export async function getStringHash(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Short hash for display (first 16 chars + ... + last 16 chars)
 */
export function formatHash(hash: string, length = 16): string {
  if (hash.length <= length * 2) return hash;
  return `${hash.slice(0, length)}…${hash.slice(-length)}`;
}