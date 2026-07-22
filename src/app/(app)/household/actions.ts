"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

// The seeded demo user is a single row shared by everyone using "Try the demo",
// so household mutations are blocked for it (they'd leak across demo viewers).
async function realUser() {
  const user = await requireUser();
  return user.isDemo ? null : user;
}

function refresh() {
  revalidatePath("/household");
  revalidatePath("/dashboard");
}

export async function createHousehold(formData: FormData) {
  const user = await realUser();
  if (!user || user.householdId) return;
  const name = String(formData.get("name") || "").trim() || `${user.name.split(" ")[0]}'s Household`;
  const hh = await prisma.household.create({ data: { name, createdById: user.id } });
  await prisma.user.update({ where: { id: user.id }, data: { householdId: hh.id } });
  refresh();
}

export async function inviteMember(formData: FormData) {
  const user = await realUser();
  if (!user || !user.householdId) return;
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || email === user.email.toLowerCase()) return;
  const existing = await prisma.householdInvite.findFirst({
    where: { householdId: user.householdId, email, status: "pending" },
  });
  if (!existing) {
    await prisma.householdInvite.create({
      data: { householdId: user.householdId, email, invitedById: user.id },
    });
  }
  revalidatePath("/household");
}

export async function acceptInvite(inviteId: string) {
  const user = await realUser();
  if (!user || user.householdId) return; // must leave current household first
  const invite = await prisma.householdInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status !== "pending" || invite.email !== user.email.toLowerCase()) return;
  await prisma.user.update({ where: { id: user.id }, data: { householdId: invite.householdId } });
  await prisma.householdInvite.update({ where: { id: inviteId }, data: { status: "accepted" } });
  refresh();
}

export async function declineInvite(inviteId: string) {
  const user = await requireUser();
  const invite = await prisma.householdInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.email !== user.email.toLowerCase()) return;
  await prisma.householdInvite.update({ where: { id: inviteId }, data: { status: "declined" } });
  revalidatePath("/household");
}

export async function cancelInvite(inviteId: string) {
  const user = await requireUser();
  const invite = await prisma.householdInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.householdId !== user.householdId) return;
  await prisma.householdInvite.delete({ where: { id: inviteId } });
  revalidatePath("/household");
}

export async function leaveHousehold() {
  const user = await requireUser();
  const hid = user.householdId;
  if (!hid) return;
  await prisma.user.update({ where: { id: user.id }, data: { householdId: null } });
  // If nobody's left, clean up the household + its invites.
  const remaining = await prisma.user.count({ where: { householdId: hid } });
  if (remaining === 0) {
    await prisma.householdInvite.deleteMany({ where: { householdId: hid } });
    await prisma.household.delete({ where: { id: hid } });
  }
  refresh();
}

export async function setAccountShared(accountId: string, shared: boolean) {
  const user = await requireUser();
  await prisma.account.updateMany({ where: { id: accountId, userId: user.id }, data: { shared } });
  refresh();
}

export async function setGoalShared(goalId: string, shared: boolean) {
  const user = await requireUser();
  await prisma.goal.updateMany({ where: { id: goalId, userId: user.id }, data: { shared } });
  refresh();
}
