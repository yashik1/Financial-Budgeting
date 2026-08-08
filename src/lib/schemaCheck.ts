import "server-only";
import { prisma } from "./db";

// Guards against running the app against a database that hasn't had its
// migrations applied. Without this, a missing column surfaces as a generic
// "Application error: a server-side exception has occurred" on every page that
// touches the affected model — and `/login` still renders, which makes it look
// like the app half-works rather than like a setup step was skipped.

/**
 * One column per migration that added any, newest last. Add a row here when you
 * add a migration; the check is only as good as this list.
 *
 * Deliberately a column probe rather than a read of `_prisma_migrations`:
 * `npm run db:push` produces a correct schema with no migration rows, and that
 * shouldn't be reported as drift.
 */
const REQUIRED_COLUMNS: ReadonlyArray<readonly [table: string, column: string]> = [
  ["Account", "subtype"],
  ["Goal", "accountId"],
  ["Rule", "builtIn"],
  ["Transaction", "goalId"],
  ["Transaction", "excludeFromBudget"],
  ["User", "tokenVersion"],
  ["User", "demoExpiresAt"],
];

const SETUP_HINT = `
  Run the database setup, then start again:

    npm run setup          # generate + migrate + seed
    npx prisma migrate deploy   # migrate only, keeps existing data
`;

function banner(title: string, detail: string): string {
  return `\n${"─".repeat(72)}\n  ${title}\n${"─".repeat(72)}\n${detail}${SETUP_HINT}${"─".repeat(72)}\n`;
}

/** Prisma pads its messages with blank lines and leads with a boilerplate
 *  "Invalid `prisma.x()` invocation:" header — skip to the real reason. */
function firstLine(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^Invalid `.*` invocation:?$/.test(l));
  return lines[0] ?? "unknown error";
}

/** Thrown at boot so a misconfigured deploy fails immediately and loudly. */
export class SchemaOutOfDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaOutOfDateError";
  }
}

/**
 * Verify the live database has the columns this build expects.
 *
 * Throws `SchemaOutOfDateError` on drift. A database that simply isn't
 * reachable yet is *not* an error here — that's a common startup race in
 * container deploys, and Prisma will report it per-request anyway.
 */
export async function assertSchemaUpToDate(): Promise<void> {
  const tables = [...new Set(REQUIRED_COLUMNS.map(([t]) => t))];

  let present: Array<{ table_name: string; column_name: string }>;
  try {
    present = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ANY(${tables})
    `;
  } catch (e) {
    console.warn(
      `[finbud] Couldn't verify the database schema at startup: ${firstLine(e)}.` +
        " Continuing — if the database is still starting up this is expected.",
    );
    return;
  }

  const found = new Set(present.map((r) => `${r.table_name}.${r.column_name}`));
  const missing = REQUIRED_COLUMNS.filter(([t, c]) => !found.has(`${t}.${c}`));
  if (missing.length === 0) return;

  // No columns at all from any expected table: the schema was never created.
  if (present.length === 0) {
    throw new SchemaOutOfDateError(
      banner(
        "Database is empty — no FinBud tables found.",
        `\n  Expected tables: ${tables.join(", ")}\n`,
      ),
    );
  }

  const list = missing.map(([t, c]) => `    - ${t}.${c}`).join("\n");
  throw new SchemaOutOfDateError(
    banner(
      "Database schema is out of date — pending migrations.",
      `\n  This build expects columns the database doesn't have:\n\n${list}\n`,
    ),
  );
}
