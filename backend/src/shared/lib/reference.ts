import { randomBytes } from "node:crypto";

/**
 * Human-readable intake reference, e.g. NS-20261117-7F3A9C.
 * The random suffix uses 3 bytes (24 bits) and is not a secret.
 */
export function createIntakeReference(now = new Date()): string {
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");

  const suffix = randomBytes(3).toString("hex").toUpperCase();

  return `NS-${date}-${suffix}`;
}
