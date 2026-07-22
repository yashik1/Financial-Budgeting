import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { CsvImporter } from "@/components/app/CsvImporter";
import { ArrowLeft, Download } from "lucide-react";

export default async function ImportPage() {
  const user = await requireUser();
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/accounts" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to accounts
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Import transactions</h1>
        <p className="text-sm text-muted">
          Upload a CSV export from your bank or brokerage. We’ll map the columns and auto-categorize every row.
        </p>
      </header>

      <a href="/sample-transactions.csv" download className="chip bg-surface-2 text-brand hover:underline">
        <Download className="h-3.5 w-3.5" /> Download a sample CSV to try
      </a>

      <CsvImporter accounts={accounts} />
    </div>
  );
}
