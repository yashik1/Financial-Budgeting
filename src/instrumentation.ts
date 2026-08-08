// Runs once when the server boots. Config that would otherwise fail on a
// user's first login is checked here so a bad deploy is obvious immediately.
//
// This file is bundled for the edge runtime as well as node, so it must not
// import anything that reaches for `node:*` builtins — hence the inlined
// ENCRYPTION_KEY check rather than importing `lib/crypto`.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertAuthSecret } = await import("./lib/auth");
  assertAuthSecret();

  // Catches "I pulled new code but didn't migrate", which otherwise shows up as
  // an opaque 500 on the first page that touches the changed model.
  const { assertSchemaUpToDate } = await import("./lib/schemaCheck");
  await assertSchemaUpToDate();

  // Provider credentials are encrypted at rest; warn rather than crash, since
  // the demo and CSV import work fine without any provider configured.
  const key = process.env.ENCRYPTION_KEY;
  if (process.env.NODE_ENV === "production" && !(key && /^[0-9a-fA-F]{64}$/.test(key))) {
    console.warn(
      "[finbud] ENCRYPTION_KEY is missing or malformed — connecting a bank or broker will fail until it's set to 64 hex chars.",
    );
  }
}
