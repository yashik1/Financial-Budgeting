import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const queryRaw = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));

const { assertSchemaUpToDate, SchemaOutOfDateError } = await import("@/lib/schemaCheck");

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

  it("does not throw when the database is merely unreachable yet", async () => {
    // Container deploys routinely start the app before Postgres accepts
    // connections; that must not be a fatal boot error.
    // Throws synchronously rather than returning a rejected promise: Vitest
    // tracks a rejecting async mock's result and reports it as an unhandled
    // rejection even once the code under test has caught it. Both land in the
    // same catch, so this exercises the path we care about.
    queryRaw.mockImplementation(() => {
      throw new Error("\nInvalid `prisma.$queryRaw()` invocation:\n\n\nCan't reach database server\n");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(assertSchemaUpToDate()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Can't reach database server"));
    warn.mockRestore();
  });
});
