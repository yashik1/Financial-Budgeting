"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { categorize } from "@/lib/categorize";
import { dollarsToCents } from "@/lib/money";

async function ownTransaction(userId: string, id: string) {
  const t = await prisma.transaction.findUnique({ where: { id } });
  return t && t.userId === userId ? t : null;
}

export async function recategorizeTransaction(txnId: string, categoryId: string) {
  const user = await requireUser();
  if (!(await ownTransaction(user.id, txnId))) return;
  await prisma.transaction.update({ where: { id: txnId }, data: { categoryId: categoryId || null } });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function setBudgetLimit(categoryId: string, month: string, dollars: string) {
  const user = await requireUser();
  const cat = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id } });
  if (!cat) return;
  const limitCents = Math.max(0, dollarsToCents(dollars));
  await prisma.budgetLine.upsert({
    where: { userId_categoryId_month: { userId: user.id, categoryId, month } },
    update: { limitCents },
    create: { userId: user.id, categoryId, month, limitCents },
  });
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}

export async function createGoal(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const emoji = String(formData.get("emoji") || "🎯").trim() || "🎯";
  const target = dollarsToCents(String(formData.get("target") || "0"));
  if (!name || target <= 0) return;
  await prisma.goal.create({
    data: { userId: user.id, name, emoji, targetCents: target, savedCents: 0, color: "#635BFF" },
  });
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function fundGoal(goalId: string, dollars: string) {
  const user = await requireUser();
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId: user.id } });
  if (!goal) return;
  const add = dollarsToCents(dollars);
  const saved = Math.max(0, goal.savedCents + add);
  await prisma.goal.update({ where: { id: goalId }, data: { savedCents: saved } });
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function deleteGoal(goalId: string) {
  const user = await requireUser();
  await prisma.goal.deleteMany({ where: { id: goalId, userId: user.id } });
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function addManualTransaction(formData: FormData) {
  const user = await requireUser();
  const accountId = String(formData.get("accountId") || "");
  const acct = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!acct) return;
  const merchant = String(formData.get("merchant") || "").trim() || "Manual entry";
  const flow = String(formData.get("flow") || "out"); // in | out
  const magnitude = Math.abs(dollarsToCents(String(formData.get("amount") || "0")));
  const amountCents = flow === "in" ? magnitude : -magnitude;
  const dateStr = String(formData.get("date") || "");
  const date = dateStr ? new Date(dateStr) : new Date();

  const rules = await prisma.rule.findMany({ where: { userId: user.id } });
  const catName = categorize(merchant, rules.map((r) => ({ matcher: r.matcher, category: r.categoryId, priority: r.priority })));
  await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId,
      date,
      amountCents,
      merchant,
      rawDescription: merchant,
      categoryId: catName ?? null,
    },
  });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function addDemoAccounts() {
  const user = await requireUser();
  const { generateDemoFinancials } = await import("@/lib/aggregation/demo");
  const { accounts, transactions } = generateDemoFinancials({ months: 3 });
  const rules = await prisma.rule.findMany({ where: { userId: user.id } });
  const ruleList = rules.map((r) => ({ matcher: r.matcher, category: r.categoryId, priority: r.priority }));

  for (const a of accounts) {
    const existing = await prisma.account.findFirst({ where: { userId: user.id, externalId: a.externalId } });
    if (existing) continue;
    const created = await prisma.account.create({
      data: {
        userId: user.id, name: a.name, type: a.type, institution: a.institution, mask: a.mask,
        balanceCents: a.balanceCents, currency: a.currency, isAsset: a.isAsset, color: a.color,
        providerId: "demo", externalId: a.externalId,
      },
    });
    const accTxns = transactions.filter((t) => t.accountExternalId === a.externalId);
    await prisma.transaction.createMany({
      data: accTxns.map((t) => ({
        userId: user.id, accountId: created.id, date: t.date, amountCents: t.amountCents,
        merchant: t.merchant, rawDescription: t.rawDescription, isTransfer: t.isTransfer,
        categoryId: categorize(t.rawDescription, ruleList) ?? null,
      })),
    });
  }
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export type ImportRowInput = {
  date: string; // ISO
  amountCents: number;
  merchant: string;
  rawDescription: string;
};

export async function importTransactions(accountId: string, rows: ImportRowInput[]) {
  const user = await requireUser();
  const acct = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!acct) return { imported: 0 };
  const rules = await prisma.rule.findMany({ where: { userId: user.id } });
  const ruleList = rules.map((r) => ({ matcher: r.matcher, category: r.categoryId, priority: r.priority }));

  const data = rows
    .filter((r) => r.date && !Number.isNaN(new Date(r.date).getTime()))
    .map((r) => ({
      userId: user.id,
      accountId,
      date: new Date(r.date),
      amountCents: r.amountCents,
      merchant: r.merchant || "Imported",
      rawDescription: r.rawDescription || r.merchant,
      categoryId: categorize(r.rawDescription || r.merchant, ruleList) ?? null,
    }));

  await prisma.transaction.createMany({ data });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { imported: data.length };
}

export async function addManualAccount(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "checking");
  const institution = String(formData.get("institution") || "Manual").trim() || "Manual";
  const isLiability = type === "credit" || type === "loan";
  const magnitude = Math.abs(dollarsToCents(String(formData.get("balance") || "0")));
  const balanceCents = isLiability ? -magnitude : magnitude;
  if (!name) return;
  await prisma.account.create({
    data: {
      userId: user.id, name, type, institution, mask: "0000",
      balanceCents, isAsset: !isLiability, providerId: "manual",
      color: isLiability ? "#E14C60" : "#635BFF",
    },
  });
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}
