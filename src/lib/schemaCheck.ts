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

function banner(title: string, detail: string, hint: string = SETUP_HINT): string {
  const rule = "─".repeat(72);
  return `\n${rule}\n  ${title}\n${rule}\n${detail}${hint}${rule}\n`;
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

/** Thrown when the database never became reachable during startup. */
export class DatabaseUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseUnreachableError";
  }
}

/** Retry budget for the initial connection: enough to ride out a container
 *  that starts before Postgres, short enough that a genuinely-down database is
 *  reported quickly rather than silently 500ing every request. */
const CONNECT_ATTEMPTS = 5;
const CONNECT_BACKOFF_MS = [500, 1000, 2000, 4000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Verify the live database is reachable and has the columns this build expects.
 *
 * Throws `SchemaOutOfDateError` on drift, or `DatabaseUnreachableError` if the
 * connection never comes up. Both are fatal by design: a server that boots
 * "successfully" and then returns an opaque 500 on every page is far harder to
 * diagnose than one that refuses to start and says why. Under an orchestrator
 * this crash-loops until the database is ready, which is the desired behaviour.
 */
export async function assertSchemaUpToDate(): Promise<void> {
  const tables = [...new Set(REQUIRED_COLUMNS.map(([t]) => t))];

  let present: Array<{ table_name: string; column_name: string }> | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt < CONNECT_ATTEMPTS; attempt++) {
    try {
      present = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = ANY(${tables})
      `;
      break;
    } catch (e) {
      lastError = e;
      const wait = CONNECT_BACKOFF_MS[attempt];
      if (wait === undefined) break; // out of retries
      console.warn(
        `[finbud] Database not reachable yet (${firstLine(e)}) — retrying in ${wait}ms.`,
      );
      await sleep(wait);
    }
  }

  if (!present) {
    throw new DatabaseUnreachableError(
      banner("Can't reach the database.", `\n  ${firstLine(lastError)}\n`, `
  Start Postgres, then start the app again:

    docker compose up -d db

  If it runs somewhere else, check DATABASE_URL in .env.
`),
    );
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
