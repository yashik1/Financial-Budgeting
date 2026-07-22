"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCents } from "@/lib/money";

type Slice = { id: string; name: string; icon?: string; color: string; cents: number };

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload as Slice;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-card">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
        {s.icon} {s.name}
      </div>
      <div className="mt-0.5 font-bold tabular">{formatCents(s.cents)}</div>
    </div>
  );
}

/** Collapse a long tail into "Other" so the donut never exceeds ~7 slices. */
export function foldSlices(slices: Slice[], max = 6): Slice[] {
  if (slices.length <= max) return slices;
  const head = slices.slice(0, max);
  const tail = slices.slice(max);
  const otherCents = tail.reduce((s, x) => s + x.cents, 0);
  return [...head, { id: "__other__", name: "Other", icon: "•", color: "#7A879C", cents: otherCents }];
}

export function CategoryDonut({ data }: { data: Slice[] }) {
  const slices = foldSlices(data);
  const total = slices.reduce((s, x) => s + x.cents, 0);

  return (
    <div className="relative h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="cents"
            nameKey="name"
            innerRadius="62%"
            outerRadius="100%"
            paddingAngle={2}
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            {slices.map((s) => (
              <Cell key={s.id} fill={s.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-wide text-muted">Spent</div>
          <div className="text-lg font-extrabold tabular">{formatCents(total, { compact: true })}</div>
        </div>
      </div>
    </div>
  );
}
