import { describe, it, expect } from "vitest";
import { signInSchema, signUpSchema, emailSchema, passwordSchema, MIN_PASSWORD_LENGTH } from "@/lib/validation";
import { dollarsToCents, MAX_CENTS, MIN_CENTS } from "@/lib/money";

describe("email validation", () => {
  it("normalizes case and whitespace", () => {
    expect(emailSchema.parse("  Alex@Example.COM ")).toBe("alex@example.com");
  });

  it("rejects malformed addresses", () => {
    for (const bad of ["", "nope", "a@", "@b.com", "a b@c.com"]) {
      expect(emailSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects addresses past the RFC length limit", () => {
    expect(emailSchema.safeParse(`${"a".repeat(250)}@example.com`).success).toBe(false);
  });
});

describe("password policy", () => {
  it(`requires at least ${MIN_PASSWORD_LENGTH} characters`, () => {
    const ok = "otter-ladder-pinecone";
    expect(passwordSchema.safeParse(ok.slice(0, MIN_PASSWORD_LENGTH - 1)).success).toBe(false);
    expect(passwordSchema.safeParse(ok.slice(0, MIN_PASSWORD_LENGTH)).success).toBe(true);
  });

  it("rejects guessable passwords that clear the length bar", () => {
    // Each of these is >= 12 chars, so only the weakness screen can catch them.
    for (const weak of [
      "passwordpassword",
      "PasswordPassword", // case-insensitive
      "qwertyuiop12",
      "iloveyou1234",
      "aaaaaaaaaaaa", // single repeated character
      "123456789012", // all digits
      "abcdefghijkl", // straight alphabet run
      "lkjihgfedcba", // ...and backwards
    ]) {
      expect(passwordSchema.safeParse(weak).success, weak).toBe(false);
    }
  });

  it("caps length so scrypt can't be used to burn CPU", () => {
    expect(passwordSchema.safeParse("a".repeat(10_000)).success).toBe(false);
  });

  it("accepts a decent passphrase", () => {
    expect(passwordSchema.safeParse("otter-ladder-pinecone").success).toBe(true);
  });
});

describe("signUp schema", () => {
  it("accepts a well-formed signup", () => {
    const r = signUpSchema.safeParse({ name: " Alex ", email: "A@b.com", password: "otter-ladder-pinecone" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ name: "Alex", email: "a@b.com" });
  });

  it("rejects a blank name", () => {
    expect(signUpSchema.safeParse({ name: "   ", email: "a@b.com", password: "otter-ladder-pinecone" }).success).toBe(false);
  });
});

describe("signIn schema", () => {
  it("does not apply the password policy to existing accounts", () => {
    // An account created under the old 6-char minimum must still be able to sign in.
    expect(signInSchema.safeParse({ email: "a@b.com", password: "old123" }).success).toBe(true);
  });

  it("still requires both fields", () => {
    expect(signInSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("money clamping", () => {
  it("clamps above the int4 ceiling instead of overflowing", () => {
    expect(dollarsToCents("99999999999")).toBe(MAX_CENTS);
    expect(dollarsToCents(-99999999999)).toBe(MIN_CENTS);
  });

  it("handles values that parse to Infinity", () => {
    expect(dollarsToCents("1e400")).toBe(0);
  });

  it("still returns 0 for junk", () => {
    expect(dollarsToCents("abc")).toBe(0);
    expect(dollarsToCents("")).toBe(0);
  });

  it("leaves ordinary amounts alone", () => {
    expect(dollarsToCents("12.34")).toBe(1234);
    expect(dollarsToCents(-89.99)).toBe(-8999);
  });
});
