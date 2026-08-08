import { z } from "zod";

// Shared input schemas. Server actions receive FormData, which is all strings
// and entirely attacker-controlled, so anything that reaches the database gets
// parsed through here first.

/** scrypt cost scales with input length — cap it so a huge body can't burn CPU. */
const PASSWORD_MAX = 200;

/**
 * Length beats complexity rules (NIST SP 800-63B): mandatory symbol/digit
 * classes push people toward "Password1!" patterns. We require 12 characters
 * and additionally screen out the shapes that stay common *at* that length.
 */
export const MIN_PASSWORD_LENGTH = 12;

// Substrings that make a long password guessable anyway — "passwordpassword"
// and "qwertyuiop12" both clear 12 characters but are in every wordlist.
// An exact-match list would be useless here: anything short enough to appear in
// a top-100 list is already rejected by the length rule.
const WEAK_SUBSTRINGS = [
  "password", "passwort", "contrasena", "qwerty", "asdfgh", "zxcvbn",
  "letmein", "iloveyou", "trustno1", "welcome", "monkey", "dragon",
  "football", "baseball", "princess", "sunshine", "admin", "administrator",
  "changeme", "secret", "finbud",
];

/** Straight runs to reject, checked in both directions. Kept separate so a
 *  password can't accidentally "span" from digits into letters. */
const RUNS = ["01234567890", "abcdefghijklmnopqrstuvwxyz"];

function isRun(p: string): boolean {
  return RUNS.some((seq) => {
    const back = [...seq].reverse().join("");
    return seq.includes(p) || back.includes(p);
  });
}

function isWeak(raw: string): boolean {
  const p = raw.toLowerCase();
  if (WEAK_SUBSTRINGS.some((w) => p.includes(w))) return true;
  // A single repeated character ("aaaaaaaaaaaa", "111111111111").
  if (/^(.)\1+$/.test(p)) return true;
  // Nothing but digits, however long ("123456789012", "198519851985").
  if (/^\d+$/.test(p)) return true;
  if (isRun(p)) return true;
  return false;
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Enter a valid email address.")
  .max(254, "That email address is too long.") // RFC 5321
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(PASSWORD_MAX, "That password is too long.")
  .refine((p) => !isWeak(p), "That password is too guessable — try a few unrelated words instead.");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(80, "That name is too long.");

export const signInSchema = z.object({
  // Sign-in only checks presence: an existing account may predate the current
  // policy, and echoing rules back here would confirm which emails exist.
  email: z.string().trim().toLowerCase().min(1, "Email and password are required."),
  password: z.string().min(1, "Email and password are required.").max(PASSWORD_MAX),
});

export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

/** First error message from a failed parse, for surfacing in form state. */
export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the form and try again.";
}

/** Read a FormData field as a string, tolerating File values and nulls. */
export function field(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
