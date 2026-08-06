"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { categorize } from "@/lib/categorize";
import { dollarsToCents, formatCents, safeCurrency } from "@/lib/money";
import { isAssetForKind, kindForSubtype, KINDS } from "@/lib/accountTypes";

const KIND_SET = new Set(KINDS.map((k) => k.kind));
function safeKind(input: string): string {
  return KIND_SET.has(input as (typeof KINDS)[number]["kind"]) ? input : "checking";
}
/** ISO-2 country code or null. */
function safeCountry(input: string): string | null {
  const c = input.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

export async function setUserCurrency(formData: FormData) {
  const user = await requireUser();
  const currency = safeCurrency(String(formData.get("currency") || ""));
  await prisma.user.update({ where: { id: user.id }, data: { currency } });
  // Money is shown everywhere, so refresh the whole app shell.
  revalidatePath("/", "layout");
}

export async function setUserCountry(formData: FormData) {
  const user = await requireUser();
  const country = safeCountry(String(formData.get("country") || ""));
  await prisma.user.update({ where: { id: user.id }, data: { country } });
  revalidatePath("/settings");
  revalidatePath("/accounts");
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

/** Delete a subcategory: its transactions become uncategorized; limits/rules go. */
export async function deleteSubcategory(categoryId: string) {
  const user = await requireUser();
  const cat = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id } });
  if (!cat || !cat.parentId) return; // only real subcategories, never top-level
  await prisma.transaction.updateMany({ where: { userId: user.id, categoryId }, data: { categoryId: null } });
  await prisma.budgetLine.deleteMany({ where: { userId: user.id, categoryId } });
  await prisma.rule.deleteMany({ where: { userId: user.id, categoryId } });
  await prisma.category.delete({ where: { id: categoryId } });
  revalidatePath("/budgets");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
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

// --- Bulk transaction edits (from the Transactions multi-select) ---

export async function bulkCategorize(ids: string[], categoryId: string) {
  const user = await requireUser();
  if (!ids.length) return;
  await prisma.transaction.updateMany({
    where: { id: { in: ids }, userId: user.id },
    data: { categoryId: categoryId || null },
  });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function bulkAddTag(ids: string[], rawTag: string) {
  const user = await requireUser();
  const tag = rawTag.trim().toLowerCase();
  if (!ids.length || !tag) return;
  // Scalar-array push per row so we can skip rows that already have the tag.
  const rows = await prisma.transaction.findMany({
    where: { id: { in: ids }, userId: user.id },
    select: { id: true, tags: true },
  });
  await Promise.all(
    rows
      .filter((r) => !r.tags.includes(tag))
      .map((r) =>
        prisma.transaction.update({
          where: { id: r.id },
          data: { tags: { set: [...r.tags, tag].slice(0, 12) } },
        }),
      ),
  );
  revalidatePath("/transactions");
}

export async function bulkDeleteTransactions(ids: string[]) {
  const user = await requireUser();
  if (!ids.length) return;
  await prisma.transaction.deleteMany({ where: { id: { in: ids }, userId: user.id } });
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

// Validate that an account belongs to the user (or clear the link).
async function ownAccountId(userId: string, raw: string): Promise<string | null> {
  const id = raw.trim();
  if (!id) return null;
  const acct = await prisma.account.findFirst({ where: { id, userId }, select: { id: true } });
  return acct ? acct.id : null;
}

export async function createGoal(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const emoji = String(formData.get("emoji") || "🎯").trim() || "🎯";
  const target = dollarsToCents(String(formData.get("target") || "0"));
  if (!name || target <= 0) return;
  const accountId = await ownAccountId(user.id, String(formData.get("accountId") || ""));
  const deadlineStr = String(formData.get("deadline") || "");
  await prisma.goal.create({
    data: {
      userId: user.id,
      name,
      emoji,
      targetCents: target,
      savedCents: 0,
      color: "#635BFF",
      accountId,
      deadline: deadlineStr ? new Date(deadlineStr) : null,
    },
  });
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function updateGoal(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  const goal = await prisma.goal.findFirst({ where: { id, userId: user.id } });
  if (!goal) return;
  const name = String(formData.get("name") || "").trim() || goal.name;
  const emoji = String(formData.get("emoji") || "").trim() || goal.emoji;
  const targetStr = String(formData.get("target") || "");
  const targetCents = targetStr ? Math.max(1, dollarsToCents(targetStr)) : goal.targetCents;
  const accountId = await ownAccountId(user.id, String(formData.get("accountId") || ""));
  const deadlineStr = String(formData.get("deadline") || "");
  await prisma.goal.update({
    where: { id },
    data: { name, emoji, targetCents, accountId, deadline: deadlineStr ? new Date(deadlineStr) : null },
  });
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

// Read the country/kind/subtype trio from a form, keeping kind and subtype
// consistent (a subtype forces its own kind).
function readAccountType(formData: FormData): { type: string; subtype: string | null; country: string | null } {
  const country = safeCountry(String(formData.get("country") || ""));
  const subRaw = String(formData.get("subtype") || "").trim();
  const subtype = subRaw || null;
  const kindFromSub = subtype ? kindForSubtype(subtype) : undefined;
  const type = kindFromSub ?? safeKind(String(formData.get("type") || "checking"));
  return { type, subtype, country };
}

export async function addManualAccount(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const institution = String(formData.get("institution") || "Manual").trim() || "Manual";
  const { type, subtype, country } = readAccountType(formData);
  const asset = isAssetForKind(type);
  const magnitude = Math.abs(dollarsToCents(String(formData.get("balance") || "0")));
  const balanceCents = asset ? magnitude : -magnitude;
  const currency = safeCurrency(String(formData.get("currency") || user.currency));
  await prisma.account.create({
    data: {
      userId: user.id, name, type, subtype, country: country ?? user.country ?? null,
      institution, mask: "0000", balanceCents, currency, isAsset: asset, providerId: "manual",
      color: asset ? "#635BFF" : "#E14C60",
    },
  });
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function updateAccount(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  const acct = await prisma.account.findFirst({ where: { id, userId: user.id } });
  if (!acct) return;
  const name = String(formData.get("name") || "").trim() || acct.name;
  const institution = String(formData.get("institution") || "").trim() || acct.institution;
  const { type, subtype, country } = readAccountType(formData);
  const asset = isAssetForKind(type);
  const magnitude = Math.abs(dollarsToCents(String(formData.get("balance") || "0")));
  const balanceCents = asset ? magnitude : -magnitude;
  const currency = safeCurrency(String(formData.get("currency") || acct.currency));
  const shared = formData.get("shared") != null;
  await prisma.account.update({
    where: { id },
    data: {
      name, institution, type, subtype, country, balanceCents, currency, isAsset: asset, shared,
      color: asset ? (acct.isAsset ? acct.color : "#635BFF") : "#E14C60",
    },
  });
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/household");
}

export async function deleteAccount(accountId: string) {
  const user = await requireUser();
  // Cascade removes the account's transactions (see schema onDelete: Cascade).
  await prisma.account.deleteMany({ where: { id: accountId, userId: user.id } });
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

/** Above any built-in rule's priority (which is just its keyword length). */
const USER_RULE_PRIORITY = 1000;

/** A merchant keyword → category rule, applied to everything imported from here on. */
export async function createRule(formData: FormData) {
  const user = await requireUser();
  const matcher = String(formData.get("matcher") || "").trim();
  const categoryId = String(formData.get("categoryId") || "");
  if (!matcher || !categoryId) return;
  const cat = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id } });
  if (!cat) return;

  // High priority so a rule you wrote beats the built-in guess for the same keyword.
  const existing = await prisma.rule.findFirst({ where: { userId: user.id, matcher, builtIn: false } });
  if (existing) await prisma.rule.update({ where: { id: existing.id }, data: { categoryId } });
  else await prisma.rule.create({ data: { userId: user.id, matcher, categoryId, priority: USER_RULE_PRIORITY } });

  revalidatePath("/transactions/rules");
}

export async function deleteRule(ruleId: string) {
  const user = await requireUser();
  await prisma.rule.deleteMany({ where: { id: ruleId, userId: user.id } });
  revalidatePath("/transactions/rules");
}

/**
 * Run the rules over transactions that never got a category. Deliberately
 * skips already-categorized rows so a new rule can't silently rewrite history.
 */
export async function applyRulesToUncategorized() {
  const user = await requireUser();
  const rules = await prisma.rule.findMany({ where: { userId: user.id } });
  if (!rules.length) return { updated: 0 };
  const ruleList = rules.map((r) => ({ matcher: r.matcher, category: r.categoryId, priority: r.priority }));

  const pending = await prisma.transaction.findMany({
    where: { userId: user.id, categoryId: null, isTransfer: false },
    select: { id: true, merchant: true, rawDescription: true },
  });

  const byCategory = new Map<string, string[]>();
  for (const t of pending) {
    const categoryId = categorize(`${t.merchant} ${t.rawDescription ?? ""}`, ruleList);
    if (!categoryId) continue;
    byCategory.set(categoryId, [...(byCategory.get(categoryId) ?? []), t.id]);
  }

  let updated = 0;
  for (const [categoryId, ids] of byCategory) {
    const res = await prisma.transaction.updateMany({
      where: { id: { in: ids }, userId: user.id },
      data: { categoryId },
    });
    updated += res.count;
  }

  revalidatePath("/transactions/rules");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return { updated };
}
