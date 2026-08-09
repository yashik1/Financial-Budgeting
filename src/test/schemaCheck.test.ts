import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const queryRaw = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));

const { assertSchemaUpToDate, SchemaOutOfDateError, DatabaseUnreachableError } = await import(
  "@/lib/schemaCheck"
);

/** Every column the check requires, as information_schema would return them. */
const ALL_COLUMNS = [
  { table_name: "Account", column_name: "subtype" },
  { table_name: "Goal", column_name: "accountId" },
  { table_name: "Rule", column_name: "builtIn" },
  { table_name: "Transaction", column_name: "goalId" },
  { table_name: "Transaction", column_name: "excludeFromBudget" },
  { table_name: "User", column_name: "tokenVersion" },
  { table_name: "User", column_name: "demoExpiresAt" },
];

describe("schema drift check", () => {
  // Braces matter: `mockReset()` returns the mock, and an arrow that returns a
  // function hands Vitest a teardown callback — which would call the mock after
  // every test.
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("passes when every expected column is present", async () => {
    queryRaw.mockResolvedValue(ALL_COLUMNS);
    await expect(assertSchemaUpToDate()).resolves.toBeUndefined();
  });

  it("tolerates extra columns it doesn't know about", async () => {
    queryRaw.mockResolvedValue([...ALL_COLUMNS, { table_name: "User", column_name: "somethingNewer" }]);
    await expect(assertSchemaUpToDate()).resolves.toBeUndefined();
  });

  it("names the missing columns when a migration hasn't been applied", async () => {
    queryRaw.mockResolvedValue(
      ALL_COLUMNS.filter((c) => !(c.table_name === "User" && c.column_name === "tokenVersion")),
    );
    await expect(assertSchemaUpToDate()).rejects.toThrow(SchemaOutOfDateError);
    await expect(assertSchemaUpToDate()).rejects.toThrow(/User\.tokenVersion/);
  });

  it("points at setup when the database has no tables at all", async () => {
    queryRaw.mockResolvedValue([]);
    await expect(assertSchemaUpToDate()).rejects.toThrow(/Database is empty/);
  });

  it("suggests the fix in the message", async () => {
    queryRaw.mockResolvedValue(ALL_COLUMNS.slice(0, 2));
    await expect(assertSchemaUpToDate()).rejects.toThrow(/npm run setup/);
  });

  // Mocks throw synchronously rather than returning a rejected promise: Vitest
  // tracks a rejecting async mock's result and reports it as an unhandled
  // rejection even once the code under test has caught it. Both land in the
  // same catch, so this exercises the path we care about.
  const unreachable = () => {
    throw new Error("\nInvalid `prisma.$queryRaw()` invocation:\n\n\nCan't reach database server\n");
  };

  it("rides out a database that's still starting up", async () => {
    // Container deploys routinely start the app before Postgres accepts
    // connections, so a first failure must not be fatal.
    let calls = 0;
    queryRaw.mockImplementation(() => {
      if (++calls < 3) unreachable();
      return Promise.resolve(ALL_COLUMNS);
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(assertSchemaUpToDate()).resolves.toBeUndefined();
    expect(calls).toBe(3);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("retrying"));
    warn.mockRestore();
  });

  /** Run the check against a permanently-dead database, skipping the real
   *  backoff waits so the test doesn't take the full retry budget. */
  async function runWithoutWaiting(): Promise<Error> {
    queryRaw.mockImplementation(unreachable);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      const settled = assertSchemaUpToDate().then(
        () => new Error("expected it to throw, but it resolved"),
        (e: Error) => e,
      );
      await vi.advanceTimersByTimeAsync(60_000);
      return await settled;
    } finally {
      vi.useRealTimers();
      warn.mockRestore();
    }
  }

  it("gives up with an actionable message when it never connects", async () => {
    // Warning and then serving opaque 500s on every page is worse than
    // refusing to start, so exhausting the retries is fatal.
    const err = await runWithoutWaiting();
    expect(err).toBeInstanceOf(DatabaseUnreachableError);
    expect(err.message).toContain("Can't reach the database");
  });

  it("tells you to start Postgres rather than to migrate", async () => {
    const err = await runWithoutWaiting();
    expect(err.message).toContain("docker compose up -d db");
    expect(err.message).not.toContain("prisma migrate deploy");
  });
});
