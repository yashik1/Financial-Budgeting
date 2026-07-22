"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCents } from "@/lib/money";
import { shortMonthLabel } from "@/lib/dates";

type Point = { month: string; cents: number };

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-card">
      <div className="text-xs text-muted">{shortMonthLabel(p.month)}</div>
      <div className="font-bold tabular">{formatCents(p.cents)}</div>
    </div>
  );
}

export function NetWorthChart({ data }: { data: Point[] }) {
  const first = data[0];
  const last = data[data.length - 1];
  const summary =
    first && last
      ? `Net worth over ${data.length} months: ${formatCents(first.cents)} in ${shortMonthLabel(first.month)}, ${formatCents(last.cents)} in ${shortMonthLabel(last.month)}.`
      : "Net worth trend chart.";
  return (
    <div className="h-56 w-full" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7B74FF" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#7B74FF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            tickFormatter={shortMonthLabel}
            tick={{ fill: "#8b8ea3", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis hide domain={["dataMin - 100000", "dataMax + 100000"]} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#7B74FF", strokeDasharray: 4 }} />
          <Area
            type="monotone"
            dataKey="cents"
            stroke="#7B74FF"
            strokeWidth={2}
            fill="url(#nw)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
