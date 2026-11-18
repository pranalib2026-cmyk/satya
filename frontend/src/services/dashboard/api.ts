/**
 * Mock service boundary for the Citizen Dashboard.
 *
 * The reference app used an axios instance here. The Next.js frontend keeps
 * its own auth/API layer in `lib/auth-context.tsx`, so this module exposes
 * only the pieces the ported mock services actually need.
 */

export const delay = (ms = 500): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const DEMO_OTP = "123456";

export const DISCLAIMER =
  "This is legal information, not legal advice. It does not create an advocate–client relationship. For your specific situation, confirm with a qualified advocate.";
