"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { categorize } from "@/lib/categorize";
import { dollarsToCents, formatCents, safeCurrency } from "@/lib/money";

export async function setUserCurrency(formData: FormData) {
  const user = await requireUser();
  const currency = safeCurrency(String(formData.get("currency") || ""));
  await prisma.user.update({ where: { id: user.id }, data: { currency } });
  // Money is shown everywhere, so refresh the whole app shell.
  revalidatePath("/", "layout");
}

async function ownTransaction(userId: string, id: string) {
  const t = await prisma.transaction.findUnique({ where: { id } });
  return t && t.userId === userId ? t : null;
}

export async function addSubcategory(formData: FormData) {
  const user = await requireUser();
  const parentId = String(formData.get("parentId") || "");
  const name = String(formData.get("name") || "").trim();
  const icon = String(formData.get("icon") || "").trim() || "•";
  if (!name) return;
  const parent = await prisma.category.findFirst({ where: { id: parentId, userId: user.id } });
  if (!parent) return;
  const exists = await prisma.category.findFirst({ where: { userId: user.id, name } });
  if (exists) return; // names are unique per user
  await prisma.category.create({
    data: { userId: user.id, name, icon, color: parent.color, group: parent.group, parentId: parent.id, sort: 100 },
  });
  revalidatePath("/budgets");
  revalidatePath("/transactions");
}

export async function updateTransaction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  const t = await ownTransaction(user.id, id);
  if (!t) return;
  const merchant = String(formData.get("merchant") || "").trim() || t.merchant;
  const notesRaw = String(formData.get("notes") || "").trim();
  const flow = String(formData.get("flow") || (t.amountCents >= 0 ? "in" : "out"));
  const amountStr = String(formData.get("amount") || "");
  const magnitude = amountStr ? Math.abs(dollarsToCents(amountStr)) : Math.abs(t.amountCents);
  const amountCents = flow === "in" ? magnitude : -magnitude;
  const dateStr = String(formData.get("date") || "");
  const date = dateStr ? new Date(dateStr) : t.date;
  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
  await prisma.transaction.update({
    where: { id },
    data: { merchant, notes: notesRaw || null, amountCents, date, tags },
  });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function deleteTransaction(id: string) {
  const user = await requireUser();
  await prisma.transaction.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function recategorizeTransaction(txnId: string, categoryId: string) {
  const user = await requireUser();
  if (!(await ownTransaction(user.id, txnId))) return;
  await prisma.transaction.update({ where: { id: txnId }, data: { categoryId: categoryId || null } });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export type BudgetLimitResult = { ok: boolean; error?: string };

export async function setBudgetLimit(
  categoryId: string,
  month: string,
  dollars: string,
): Promise<BudgetLimitResult> {
  const user = await requireUser();
  const cat = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id } });
  if (!cat) return { ok: false, error: "Category not found." };
  const limitCents = Math.max(0, dollarsToCents(dollars));
  const currency = safeCurrency(user.currency);

  if (cat.parentId) {
    // Subcategory: its siblings' limits, plus this one, can't exceed the parent's.
    const parentLine = await prisma.budgetLine.findUnique({
      where: { userId_categoryId_month: { userId: user.id, categoryId: cat.parentId, month } },
    });
    const parentLimit = parentLine?.limitCents ?? 0;
    if (parentLimit > 0) {
      const siblings = await prisma.category.findMany({
        where: { userId: user.id, parentId: cat.parentId, id: { not: categoryId } },
        select: { id: true },
      });
      const sibLines = await prisma.budgetLine.findMany({
        where: { userId: user.id, month, categoryId: { in: siblings.map((s) => s.id) } },
      });
      const othersSum = sibLines.reduce((s, l) => s + l.limitCents, 0);
      if (othersSum + limitCents > parentLimit) {
        const parent = await prisma.category.findUnique({ where: { id: cat.parentId } });
        return {
          ok: false,
          error: `Subcategories would total ${formatCents(othersSum + limitCents, { currency })}, over the ${
            parent?.name ?? "parent"
          } budget of ${formatCents(parentLimit, { currency })}.`,
        };
      }
    }
  } else if (limitCents > 0) {
    // Parent: can't set it below what its subcategories already claim.
    const children = await prisma.category.findMany({
      where: { userId: user.id, parentId: categoryId },
      select: { id: true },
    });
    if (children.length) {
      const childLines = await prisma.budgetLine.findMany({
        where: { userId: user.id, month, categoryId: { in: children.map((c) => c.id) } },
      });
      const childSum = childLines.reduce((s, l) => s + l.limitCents, 0);
      if (childSum > limitCents) {
        return {
          ok: false,
          error: `Its subcategories already total ${formatCents(childSum, { currency })}. Raise this above that, or lower them first.`,
        };
      }
    }
  }

  await prisma.budgetLine.upsert({
    where: { userId_categoryId_month: { userId: user.id, categoryId, month } },
    update: { limitCents },
    create: { userId: user.id, categoryId, month, limitCents },
  });
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return { ok: true };
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
