"use client";

import { useMemo, useState, useTransition } from "react";
import { FileUp, CheckCircle2 } from "lucide-react";
import {
  parseCsv,
  guessMapping,
  mapRows,
  type ColumnMapping,
  type ParsedCsv,
} from "@/lib/aggregation/csv";
import { importTransactions } from "@/app/(app)/actions";
import { formatCents } from "@/lib/money";

type Account = { id: string; name: string };

export function CsvImporter({ accounts, currency = "USD" }: { accounts: Account[]; currency?: string }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mode, setMode] = useState<"single" | "split">("single");
  const [map, setMap] = useState<Partial<ColumnMapping>>({});
  const [pending, start] = useTransition();
  const [result, setResult] = useState<number | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const p = parseCsv(text);
    setParsed(p);
    const g = guessMapping(p.headers);
    setMap(g);
    setMode(g.debit != null || g.credit != null ? "split" : "single");
    setResult(null);
  }

  const preview = useMemo(() => {
    if (!parsed || map.date == null || map.description == null) return [];
    const m: ColumnMapping = {
      date: map.date,
      description: map.description,
      ...(mode === "single" ? { amount: map.amount } : { debit: map.debit, credit: map.credit }),
    };
    return mapRows(parsed.rows.slice(0, 6), m);
  }, [parsed, map, mode]);

  const allRows = useMemo(() => {
    if (!parsed || map.date == null || map.description == null) return [];
    const m: ColumnMapping = {
      date: map.date,
      description: map.description,
      ...(mode === "single" ? { amount: map.amount } : { debit: map.debit, credit: map.credit }),
    };
    return mapRows(parsed.rows, m);
  }, [parsed, map, mode]);

  const canImport = accountId && allRows.length > 0 && !pending;

  function doImport() {
    if (!canImport) return;
    start(async () => {
      const res = await importTransactions(
        accountId,
        allRows.map((r) => ({
          date: r.date.toISOString(),
          amountCents: r.amountCents,
          merchant: r.merchant,
          rawDescription: r.rawDescription,
        })),
      );
      setResult(res.imported);
      setParsed(null);
      setMap({});
    });
  }

  const ColSelect = ({ label, value, onChange, optional }: { label: string; value: number | undefined; onChange: (n: number | undefined) => void; optional?: boolean }) => (
    <div>
      <label className="label">{label}</label>
      <select
        className="input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      >
        {optional && <option value="">—</option>}
        {parsed?.headers.map((h, i) => (
          <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-5">
      {result != null && (
        <div className="card flex items-center gap-3 border-positive/40 p-4 text-positive">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-semibold text-fg">Imported {result} transactions.</span> They’re auto-categorized and on your dashboard.
        </div>
      )}

      <div className="card space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Import into account</label>
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">CSV file</label>
            <label className="btn-ghost w-full cursor-pointer">
              <FileUp className="h-4 w-4" />
              Choose file
              <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            </label>
          </div>
        </div>

        {accounts.length === 0 && (
          <p className="text-sm text-muted">Add an account first, then import transactions into it.</p>
        )}

        {parsed && (
          <>
            <div className="flex gap-2 text-sm">
              <button onClick={() => setMode("single")} className={`chip ${mode === "single" ? "bg-brand text-white" : "bg-surface-2 text-muted"}`}>Single amount column</button>
              <button onClick={() => setMode("split")} className={`chip ${mode === "split" ? "bg-brand text-white" : "bg-surface-2 text-muted"}`}>Separate debit / credit</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ColSelect label="Date" value={map.date} onChange={(n) => setMap({ ...map, date: n })} />
              <ColSelect label="Description" value={map.description} onChange={(n) => setMap({ ...map, description: n })} />
              {mode === "single" ? (
                <ColSelect label="Amount" value={map.amount} onChange={(n) => setMap({ ...map, amount: n })} />
              ) : (
                <>
                  <ColSelect label="Debit (out)" value={map.debit} onChange={(n) => setMap({ ...map, debit: n })} optional />
                  <ColSelect label="Credit (in)" value={map.credit} onChange={(n) => setMap({ ...map, credit: n })} optional />
                </>
              )}
            </div>

            {preview.length > 0 && (
              <div>
                <div className="label">Preview</div>
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-2/60 text-xs uppercase tracking-wide text-muted">
                      <tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Merchant</th><th className="p-2 text-right">Amount</th></tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-2">{r.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                          <td className="p-2">{r.merchant}</td>
                          <td className={`p-2 text-right tabular ${r.amountCents >= 0 ? "text-positive" : "text-fg"}`}>{formatCents(r.amountCents, { signed: true, currency })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted">{allRows.length} rows ready to import.</p>
              </div>
            )}

            <button onClick={doImport} disabled={!canImport} className="btn-primary w-full">
              {pending ? "Importing…" : `Import ${allRows.length} transactions`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
