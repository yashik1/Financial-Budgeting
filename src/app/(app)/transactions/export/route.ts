import { NextRequest } from "next/server";
import { getUserId } from "@/lib/session";
import { getTransactions, type TxnFilters } from "@/lib/queries";

/** RFC 4180-ish: quote every field and double any embedded quotes. */
function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * Download the current transaction view as CSV. Honors the same filters as the
 * Transactions page, so "export" always matches what's on screen.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const q = req.nextUrl.searchParams;
  const filters: TxnFilters = {
    categoryId: q.get("category") || undefined,
    accountId: q.get("account") || undefined,
    accountType: q.get("atype") || undefined,
    search: q.get("q") || undefined,
    tag: q.get("tag") || undefined,
    type: (q.get("type") as TxnFilters["type"]) || undefined,
    from: q.get("from") || undefined,
    to: q.get("to") || undefined,
    limit: 5000,
  };

  const txns = await getTransactions(userId, filters);

  const header = ["Date", "Merchant", "Description", "Amount", "Currency", "Category", "Account", "Tags", "Notes", "Transfer"];
  const rows = txns.map((t) =>
    [
      new Date(t.date).toISOString().slice(0, 10),
      t.merchant,
      t.rawDescription,
      (t.amountCents / 100).toFixed(2),
      t.account.currency,
      t.category?.name ?? "Uncategorized",
      t.account.name,
      t.tags.join(" "),
      t.notes ?? "",
      t.isTransfer ? "yes" : "no",
    ].map(csvCell).join(","),
  );

  const csv = [header.map(csvCell).join(","), ...rows].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finbud-transactions-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
