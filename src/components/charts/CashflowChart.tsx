"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCents } from "@/lib/money";
import { shortMonthLabel } from "@/lib/dates";

type Row = { month: string; incomeCents: number; spendingCents: number };

const INCOME = "#16A374";
const SPEND = "#E14C60";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-card">
      <div className="mb-1 text-xs text-muted">{shortMonthLabel(label)}</div>
      <div className="flex items-center gap-2 text-sm">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: INCOME }} />
        Income <span className="ml-auto font-semibold tabular">{formatCents(payload[0]?.value ?? 0)}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: SPEND }} />
        Spending <span className="ml-auto font-semibold tabular">{formatCents(payload[1]?.value ?? 0)}</span>
      </div>
    </div>
  );
}

export function CashflowChart({ data }: { data: Row[] }) {
  const last = data[data.length - 1];
  const summary = last
    ? `Monthly income versus spending, ${data.length} months. Latest (${shortMonthLabel(last.month)}): income ${formatCents(last.incomeCents)}, spending ${formatCents(last.spendingCents)}.`
    : "Monthly income versus spending chart.";
  return (
    <div role="img" aria-label={summary}>
      <div className="mb-2 flex items-center gap-4 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: INCOME }} /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SPEND }} /> Spending
        </span>
      </div>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={3}>
            <XAxis
              dataKey="month"
              tickFormatter={shortMonthLabel}
              tick={{ fill: "#8b8ea3", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis hide />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(128,128,140,0.08)" }} />
            <Bar dataKey="incomeCents" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="spendingCents" fill={SPEND} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
